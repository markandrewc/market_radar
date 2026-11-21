import { useMutation, useQuery } from '@tanstack/react-query';
import type {
  ConnectorConfigFile, ConnectorConfigUpdate, ConnectorList, Digest, DigestRequest, DemandResponse, EmployersResponse,
  Insight, InsightKind, MarketItem, MarketItemCategory, Overview, Role, SkillsResponse, SourceStatus, SubscribeBody,
  SubscribeResult, SyncSummary, Taxonomy,
} from '../shared/types';
import {
  mockConnectorConfig, mockConnectors, mockDemand, mockDigest, mockEmployers, mockInsights, mockOverview, mockRoles,
  mockSkills, mockSources, mockSubscribeResult, mockTaxonomy, type Scenario,
} from './mocks/data';
import { mockMarketItems } from './mocks/marketItems';

// VITE_USE_MOCKS=0 -> real backend (Vite proxies /api/ to FastAPI on :8787). Anything else -> labelled demo data.
export const useMocks = import.meta.env.VITE_USE_MOCKS !== '0';
// With mocks: VITE_MOCK_SCENARIO = normal | empty | short | error, to see every screen state.
const scenario = (import.meta.env.VITE_MOCK_SCENARIO ?? 'normal') as Scenario;

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

const auth = (token?: string): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {});

async function call<T>(method: string, path: string, body?: unknown, token?: string): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...auth(token) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    const detail = Array.isArray(payload.detail)
      ? payload.detail.map((d: { msg?: string }) => d.msg).join('; ')
      : payload.detail;
    throw new ApiError(typeof detail === 'string' && detail ? detail : res.statusText, res.status);
  }
  return res.json() as Promise<T>;
}

const get = <T,>(path: string, token?: string) => call<T>('GET', path, undefined, token);
const post = <T,>(path: string, body?: unknown, token?: string) => call<T>('POST', path, body, token);

// The current YAML is sent as the raw request body, not as JSON.
async function putYaml(path: string, yaml: string, token: string): Promise<ConnectorConfigUpdate> {
  const res = await fetch(`/api${path}`, { method: 'PUT', headers: { 'Content-Type': 'text/plain', ...auth(token) }, body: yaml });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = Array.isArray(payload.detail) ? payload.detail.join(' ') : payload.detail ?? payload.errors?.join?.(' ');
    throw new ApiError(typeof detail === 'string' && detail ? detail : res.statusText, res.status);
  }
  return payload as ConnectorConfigUpdate;
}

async function mock<T>(value: () => T): Promise<T> {
  await new Promise((r) => setTimeout(r, 300));
  if (scenario === 'error') throw new ApiError('Mock error', 500);
  return value();
}

/** One entry per role. If several sources have the same role, the one with the longest history wins. */
export function bestPerRole(list: DemandResponse[]): DemandResponse[] {
  const best = new Map<string, DemandResponse>();
  for (const d of list) {
    const cur = best.get(d.role.id);
    if (!cur || d.series.length > cur.series.length) best.set(d.role.id, d);
  }
  return [...best.values()];
}

// ---- Level 1: roles, demand and skills -------------------------------------
export const useRoles = () =>
  useQuery({ queryKey: ['roles'], queryFn: (): Promise<Role[]> => (useMocks ? mock(mockRoles) : get('/roles')) });

export const useDemand = (months = 12) =>
  useQuery({
    queryKey: ['demand', months],
    queryFn: async (): Promise<DemandResponse[]> =>
      bestPerRole(useMocks ? await mock(() => mockDemand(scenario, months)) : await get<DemandResponse[]>(`/demand?months=${months}`)),
  });

// No role id = all postings together (the backend's pseudo role "all").
export const useSkills = (roleId?: string) =>
  useQuery({
    queryKey: ['skills', roleId],
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 1,
    queryFn: async (): Promise<SkillsResponse> => {
      if (useMocks) return mock(() => mockSkills(roleId ?? 'web-developer'));
      const r = await get<SkillsResponse>(`/skills${roleId ? `?role=${encodeURIComponent(roleId)}` : ''}`);
      return { ...r, skills: r.skills.slice(0, 10) };
    },
  });

// ---- Items: the normalised records of every source (categories A-E) --------
export interface ItemFilter {
  category?: MarketItemCategory;
  /** Canton code such as ZH or BE. */
  region?: string;
  source?: string;
  q?: string;
  limit?: number;
}

export const useItems = (filter: ItemFilter = {}) =>
  useQuery({
    queryKey: ['items', filter],
    queryFn: (): Promise<MarketItem[]> => {
      if (!useMocks) {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(filter)) if (value !== undefined && value !== '') params.set(key, String(value));
        const query = params.toString();
        return get(`/items${query ? `?${query}` : ''}`);
      }
      let items = mockMarketItems();
      if (filter.category) items = items.filter((item) => item.categories.includes(filter.category!));
      if (filter.region) items = items.filter((item) => item.region === filter.region);
      if (filter.source) items = items.filter((item) => item.source_name === filter.source);
      if (filter.q) {
        const needle = filter.q.toLowerCase();
        items = items.filter((item) => `${item.title} ${item.summary}`.toLowerCase().includes(needle));
      }
      if (filter.limit) items = items.slice(0, filter.limit);
      return mock(() => items);
    },
  });

export const useSources = () =>
  useQuery({ queryKey: ['sources'], queryFn: (): Promise<SourceStatus[]> => (useMocks ? mock(mockSources) : get('/sources')) });

// ---- Level 3: who is hiring (category C) -----------------------------------
export const useEmployers = (roleId: string) =>
  useQuery({
    queryKey: ['employers', roleId],
    queryFn: (): Promise<EmployersResponse> =>
      useMocks ? mock(() => mockEmployers(roleId)) : get(`/employers?role=${encodeURIComponent(roleId)}`),
  });

// ---- Insights: our plain-language reading ---------------------------------
export const useOverview = () =>
  useQuery({
    queryKey: ['overview'],
    queryFn: (): Promise<Overview> => (useMocks ? mock(mockOverview) : get('/overview')),
  });

export interface InsightFilter {
  role?: string;
  kind?: InsightKind;
  limit?: number;
}

export const useInsights = (filter: InsightFilter = {}) =>
  useQuery({
    queryKey: ['insights', filter],
    queryFn: (): Promise<Insight[]> => {
      if (useMocks) return mock(() => mockInsights(filter));
      const params = new URLSearchParams();
      if (filter.role) params.set('role', filter.role);
      if (filter.kind) params.set('kind', filter.kind);
      if (filter.limit) params.set('limit', String(filter.limit));
      const query = params.toString();
      return get(`/insights${query ? `?${query}` : ''}`);
    },
  });

export const useTaxonomy = () =>
  useQuery({
    queryKey: ['taxonomy'],
    staleTime: 5 * 60_000,
    queryFn: (): Promise<Taxonomy> => (useMocks ? mock(mockTaxonomy) : get('/insights/taxonomy')),
  });

// ---- Level 2: briefings ----------------------------------------------------
export const useDigestPreview = () =>
  useMutation({
    mutationFn: (body: DigestRequest): Promise<Digest> => (useMocks ? mock(() => mockDigest(body)) : post('/reports/preview', body)),
  });

export const useSubscribe = () =>
  useMutation({
    mutationFn: (body: SubscribeBody): Promise<SubscribeResult> =>
      useMocks ? mock(() => mockSubscribeResult(body)) : post('/subscriptions', body),
  });

// ---- Level 4: connectors and the operator panel ----------------------------
export const useConnectors = () =>
  useQuery({
    queryKey: ['connectors'],
    queryFn: (): Promise<ConnectorList> => (useMocks ? mock(mockConnectors) : get('/connectors')),
    refetchInterval: 60_000,
  });

export const useConnectorConfig = (token: string) =>
  useQuery({
    queryKey: ['connector-config', token],
    enabled: Boolean(token),
    retry: false,
    queryFn: (): Promise<ConnectorConfigFile> => (useMocks ? mock(mockConnectorConfig) : get('/connectors/config', token)),
  });

export const useApplyConnectorConfig = (token: string) =>
  useMutation({
    mutationFn: (yaml: string): Promise<ConnectorConfigUpdate> =>
      useMocks
        ? mock(() => ({ ...mockConnectorConfig(), sha256: 'demo', added: 0, updated: 0, disabled: 0, sourceCount: 0, errors: [], persistent: false }))
        : putYaml('/connectors/config', yaml, token),
  });

export const useSyncConnectors = (token: string) =>
  useMutation({
    mutationFn: (options: { dueOnly: boolean; source?: string }): Promise<SyncSummary> => {
      if (useMocks) return mock(() => ({ results: [], items: 0, errors: 0 }));
      const params = new URLSearchParams();
      if (options.dueOnly) params.set('due_only', 'true');
      if (options.source) params.set('source', options.source);
      const query = params.toString();
      return post(`/connectors/sync${query ? `?${query}` : ''}`, undefined, token);
    },
  });

export const useReloadConnectors = (token: string) =>
  useMutation({
    mutationFn: () =>
      useMocks
        ? mock(() => ({ added: 0, updated: 0, disabled: 0, sourceCount: 0, configSha256: 'demo', errors: [] as string[] }))
        : post('/connectors/reload', undefined, token),
  });

import { useMutation, useQuery } from '@tanstack/react-query';
import type {
  ConnectorConfigFile, ConnectorConfigUpdate, ConnectorList, Digest, DigestRequest, DemandResponse, EmployersResponse,
  MarketItem, MarketItemCategory, Role, SkillsResponse, SourceStatus, SubscribeBody, SubscribeResult, SyncSummary,
} from '../shared/types';
import {
  mockConnectorConfig, mockConnectors, mockDemand, mockDigest, mockEmployers, mockRoles, mockSkills, mockSources,
  mockSubscribeResult,
} from './mocks/data';
import { mockMarketItems } from './mocks/marketItems';

// VITE_USE_MOCKS=0 -> real backend for every endpoint below (Vite proxies /api/ to FastAPI on :8787).
// Anything else -> labelled demo data. The banner in App.tsx marks mock mode.
export const useMocks = import.meta.env.VITE_USE_MOCKS !== '0';

const wait = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 300));

const auth = (token?: string): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {});

async function call<T>(method: string, path: string, body?: unknown, token?: string): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...auth(token) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    const detail = Array.isArray(payload.detail) ? payload.detail.map((d: { msg?: string }) => d.msg).join('; ') : payload.detail;
    throw new Error(detail || `${res.status} ${res.statusText}`);
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
    throw new Error(detail || `${res.status} ${res.statusText}`);
  }
  return payload as ConnectorConfigUpdate;
}

// ---- Level 1: demand and skills -------------------------------------------
export const useRoles = () =>
  useQuery({ queryKey: ['roles'], queryFn: (): Promise<Role[]> => (useMocks ? wait(mockRoles()) : get('/roles')) });

export const useDemand = () =>
  useQuery({ queryKey: ['demand'], queryFn: (): Promise<DemandResponse[]> => (useMocks ? wait(mockDemand()) : get('/demand')) });

export const useSkills = (roleId?: string) =>
  useQuery({
    queryKey: ['skills', roleId],
    queryFn: (): Promise<SkillsResponse> =>
      useMocks ? wait(mockSkills()) : get(`/skills${roleId ? `?role=${encodeURIComponent(roleId)}` : ''}`),
  });

// ---- Level 1/3: normalised items (categories A-E) ---------------------------
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
      return wait(items);
    },
  });

export const useSources = () =>
  useQuery({ queryKey: ['sources'], queryFn: (): Promise<SourceStatus[]> => (useMocks ? wait(mockSources()) : get('/sources')) });

// ---- Level 3: who is hiring (category C) -----------------------------------
export const useEmployers = (roleId: string) =>
  useQuery({
    queryKey: ['employers', roleId],
    queryFn: (): Promise<EmployersResponse> =>
      useMocks ? wait(mockEmployers(roleId)) : get(`/employers?role=${encodeURIComponent(roleId)}`),
  });

// ---- Level 2: briefings ----------------------------------------------------
export const useDigestPreview = () =>
  useMutation({
    mutationFn: (body: DigestRequest): Promise<Digest> => (useMocks ? wait(mockDigest(body)) : post('/reports/preview', body)),
  });

export const useSubscribe = () =>
  useMutation({
    mutationFn: (body: SubscribeBody): Promise<SubscribeResult> =>
      useMocks ? wait(mockSubscribeResult(body)) : post('/subscriptions', body),
  });

// ---- Level 4: connectors and the operator panel ----------------------------
export const useConnectors = () =>
  useQuery({
    queryKey: ['connectors'],
    queryFn: (): Promise<ConnectorList> => (useMocks ? wait(mockConnectors()) : get('/connectors')),
    refetchInterval: 60_000,
  });

export const useConnectorConfig = (token: string) =>
  useQuery({
    queryKey: ['connector-config', token],
    enabled: Boolean(token),
    retry: false,
    queryFn: (): Promise<ConnectorConfigFile> => (useMocks ? wait(mockConnectorConfig()) : get('/connectors/config', token)),
  });

export const useApplyConnectorConfig = (token: string) =>
  useMutation({
    mutationFn: (yaml: string): Promise<ConnectorConfigUpdate> =>
      useMocks ? wait({ ...mockConnectorConfig(), sha256: 'demo', added: 0, updated: 0, disabled: 0, sourceCount: 0, errors: [], persistent: false } as unknown as ConnectorConfigUpdate) : putYaml('/connectors/config', yaml, token),
  });

export const useSyncConnectors = (token: string) =>
  useMutation({
    mutationFn: (options: { dueOnly: boolean; source?: string }): Promise<SyncSummary> => {
      if (useMocks) return wait({ results: [], items: 0, errors: 0 });
      const params = new URLSearchParams();
      if (options.dueOnly) params.set('due_only', 'true');
      if (options.source) params.set('source', options.source);
      const query = params.toString();
      return post(`/connectors/sync${query ? `?${query}` : ''}`, undefined, token);
    },
  });

export const useReloadConnectors = (token: string) =>
  useMutation({
    mutationFn: () => (useMocks ? wait({ added: 0, updated: 0, disabled: 0, sourceCount: 0, configSha256: 'demo', errors: [] }) : post('/connectors/reload', undefined, token)),
  });

import { useMutation, useQuery } from '@tanstack/react-query';
import type { DemandResponse, EmployersResponse, MarketItem, MarketItemCategory, PolicyResponse, SkillsResponse, SourceStatus, SubscribeBody } from '../shared/types';
import { mockDemand, mockEmployers, mockPolicy, mockSkills, mockSources, type Scenario } from './mocks/data';
import { mockMarketItems } from './mocks/marketItems';

// VITE_USE_MOCKS=0 -> real backend for the endpoints it already has (Vite proxies /api/ to the backend on :8787).
// Anything else -> mock data. Endpoints without a backend yet always use mocks.
export const useMocks = import.meta.env.VITE_USE_MOCKS !== '0';
// With mocks: VITE_MOCK_SCENARIO = normal | empty | short | error, to see every screen state.
const scenario = (import.meta.env.VITE_MOCK_SCENARIO ?? 'normal') as Scenario;

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`);
  if (!res.ok) {
    const detail = (await res.json().catch(() => ({}))).detail;
    throw new ApiError(typeof detail === 'string' ? detail : res.statusText, res.status);
  }
  return res.json() as Promise<T>;
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

// Backend: GET /api/demand, GET /api/skills (see docs/api.md)
export const useDemand = (months = 12) =>
  useQuery({
    queryKey: ['demand', months],
    queryFn: async (): Promise<DemandResponse[]> =>
      bestPerRole(useMocks ? await mock(() => mockDemand(scenario, months)) : await get<DemandResponse[]>(`/demand?months=${months}`)),
  });

export const useSkills = (roleId: string) =>
  useQuery({
    queryKey: ['skills', roleId],
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 1,
    queryFn: async (): Promise<SkillsResponse> => {
      if (useMocks) return mock(() => mockSkills(roleId));
      const r = await get<SkillsResponse>(`/skills?role=${encodeURIComponent(roleId)}`);
      return { ...r, skills: r.skills.slice(0, 10) };
    },
  });

// Not in the backend yet: mock data only (the pages mark these sections with <DemoNotice />)
export const useEmployers = (roleId: string) => useQuery({ queryKey: ['employers', roleId], queryFn: (): Promise<EmployersResponse> => mock(() => mockEmployers(roleId)) });
export const usePolicy = () => useQuery({ queryKey: ['policy'], queryFn: (): Promise<PolicyResponse> => mock(mockPolicy) });
export const useSources = () =>
  useQuery({ queryKey: ['sources'], queryFn: (): Promise<SourceStatus[]> => (useMocks ? mock(mockSources) : get('/sources')) });
export const useSubscribe = () =>
  useMutation({ mutationFn: async (_b: SubscribeBody): Promise<{ ok: boolean; emailSent: boolean }> => mock(() => ({ ok: true, emailSent: false })) });

// Config-driven connectors. Contract: docs/market-item.schema.json.
// Backend: GET /api/items?category=&region=&source=&q=&limit= (see docs/api.md)
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

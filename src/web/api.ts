import { useMutation, useQuery } from '@tanstack/react-query';
import type { DemandResponse, EmployersResponse, MarketItem, MarketItemCategory, PolicyResponse, SkillsResponse, SourceStatus, SubscribeBody, TargetGroupResponse } from '../shared/types';
import { mockDemand, mockEmployers, mockParticipants, mockPolicy, mockSkills, mockSources } from './mocks/data';
import { mockMarketItems } from './mocks/marketItems';

// VITE_USE_MOCKS=0 -> real backend for the endpoints it already has (Vite proxies /api/ to FastAPI on :8787).
// Anything else -> mock data. Endpoints without a backend yet always use mocks.
export const useMocks = import.meta.env.VITE_USE_MOCKS !== '0';

const wait = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 400));

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`);
  if (!res.ok) throw new Error(`${res.status} ${(await res.json().catch(() => ({}))).detail ?? res.statusText}`);
  return res.json() as Promise<T>;
}

// Backend: GET /api/demand, GET /api/skills (see docs/api.md)
export const useDemand = () =>
  useQuery({ queryKey: ['demand'], queryFn: (): Promise<DemandResponse[]> => (useMocks ? wait(mockDemand()) : get('/demand')) });
export const useSkills = (roleId?: string) =>
  useQuery({
    queryKey: ['skills', roleId],
    queryFn: (): Promise<SkillsResponse> =>
      useMocks ? wait(mockSkills()) : get(`/skills${roleId ? `?role=${encodeURIComponent(roleId)}` : ''}`),
  });

// Not in the backend yet: mock data only
export const useEmployers = (roleId: string) => useQuery({ queryKey: ['employers', roleId], queryFn: (): Promise<EmployersResponse> => wait(mockEmployers(roleId)) });
export const useParticipants = () => useQuery({ queryKey: ['participants'], queryFn: (): Promise<TargetGroupResponse> => wait(mockParticipants()) });
export const usePolicy = () => useQuery({ queryKey: ['policy'], queryFn: (): Promise<PolicyResponse> => wait(mockPolicy()) });
export const useSources = () => useQuery({ queryKey: ['sources'], queryFn: (): Promise<SourceStatus[]> => wait(mockSources()) });
export const useSubscribe = () => useMutation({ mutationFn: (b: SubscribeBody) => wait({ ok: true, ...b }) });

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
      return wait(items);
    },
  });

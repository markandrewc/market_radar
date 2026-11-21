import { useMutation, useQuery } from '@tanstack/react-query';
import type { DemandResponse, EmployersResponse, PolicyResponse, SkillsResponse, SourceStatus, SubscribeBody, TargetGroupResponse } from '../shared/types';
import { mockDemand, mockEmployers, mockParticipants, mockPolicy, mockSkills, mockSources } from './mocks/data';

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

import { useQuery } from '@tanstack/react-query';
import type { DemandResponse, SkillsResponse } from '../shared/types';
import { mockDemand, mockSkills } from './mocks/data';

// VITE_USE_MOCKS=0 -> real backend (Vite proxies /api/ to the FastAPI server on :8787). Anything else -> mock data.
export const useMocks = import.meta.env.VITE_USE_MOCKS !== '0';

const wait = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 400));

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`);
  if (!res.ok) throw new Error(`${res.status} ${(await res.json().catch(() => ({}))).detail ?? res.statusText}`);
  return res.json() as Promise<T>;
}

export const useDemand = () =>
  useQuery({
    queryKey: ['demand'],
    queryFn: (): Promise<DemandResponse[]> => (useMocks ? wait(mockDemand()) : get('/demand')),
  });

export const useSkills = (role?: string) =>
  useQuery({
    queryKey: ['skills', role],
    queryFn: (): Promise<SkillsResponse> =>
      useMocks ? wait(mockSkills()) : get(`/skills${role ? `?role=${encodeURIComponent(role)}` : ''}`),
  });

import { useQuery } from '@tanstack/react-query';
import type { DemandResponse, SkillsResponse } from '../shared/types';
import { mockDemand, mockSkills } from './mocks/data';

const wait = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 400));

export const useDemand = () =>
  useQuery({ queryKey: ['demand'], queryFn: (): Promise<DemandResponse[]> => wait(mockDemand()) });
export const useSkills = () =>
  useQuery({ queryKey: ['skills'], queryFn: (): Promise<SkillsResponse> => wait(mockSkills()) });

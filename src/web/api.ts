import { useMutation, useQuery } from '@tanstack/react-query';
import type { DemandResponse, EmployersResponse, PolicyResponse, SkillsResponse, SourceStatus, SubscribeBody, TargetGroupResponse } from '../shared/types';
import { mockDemand, mockEmployers, mockParticipants, mockPolicy, mockSkills, mockSources } from './mocks/data';

const wait = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 400));

export const useDemand = () => useQuery({ queryKey: ['demand'], queryFn: (): Promise<DemandResponse[]> => wait(mockDemand()) });
export const useSkills = (roleId?: string) => useQuery({ queryKey: ['skills', roleId], queryFn: (): Promise<SkillsResponse> => wait(mockSkills()) });
export const useEmployers = (roleId: string) => useQuery({ queryKey: ['employers', roleId], queryFn: (): Promise<EmployersResponse> => wait(mockEmployers(roleId)) });
export const useParticipants = () => useQuery({ queryKey: ['participants'], queryFn: (): Promise<TargetGroupResponse> => wait(mockParticipants()) });
export const usePolicy = () => useQuery({ queryKey: ['policy'], queryFn: (): Promise<PolicyResponse> => wait(mockPolicy()) });
export const useSources = () => useQuery({ queryKey: ['sources'], queryFn: (): Promise<SourceStatus[]> => wait(mockSources()) });
export const useSubscribe = () => useMutation({ mutationFn: (b: SubscribeBody) => wait({ ok: true, ...b }) });

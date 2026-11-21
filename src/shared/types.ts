export interface SourceRef { id: string; name: string; url: string; fetchedAt: string }
export interface Point { period: string; value: number }
export interface Role { id: string; name: string }
export interface DemandResponse { role: Role; current: number; changePct: number; series: Point[]; source: SourceRef }
export interface SkillRow { skill: string; share: number; changePct: number; source: SourceRef }
export interface SkillsResponse { role: Role; skills: SkillRow[] }
export interface Employer { name: string; openings: number; topSkill: string }
export interface EmployersResponse { role: Role; employers: Employer[]; source: SourceRef }
export interface TargetGroupResponse { groups: { label: string; count: number }[]; source: SourceRef }
export interface PolicyItem { title: string; summary: string; date: string; source: SourceRef }
export interface PolicyResponse { items: PolicyItem[] }
export interface SubscribeBody { email: string; roleIds: string[] }
export interface SourceStatus { id: string; name: string; url: string; lastFetchedAt: string; status: 'ok' | 'stale' | 'error' }

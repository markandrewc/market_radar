// fetchedAt: when we last retrieved data (ISO 8601). dataAsOf: the publisher's last update (YYYY-MM-DD), if known.
// comparableFrom: YYYY-MM, the source changed how it counts; earlier months are not comparable
export interface SourceRef { id: string; name: string; url: string; fetchedAt: string; dataAsOf?: string | null; comparableFrom?: string | null }
export interface Point { period: string; value: number }
export interface Role { id: string; name: string }
// Trend: weighted linear trend over the last months with a forecast (95 % range). basis 'share' = % of all postings.
export interface ForecastPoint { period: string; value: number; low: number; high: number }
export interface Trend { basis: 'share' | 'count'; direction: 'rising' | 'falling' | 'stable'; slopePerMonth: number; months: number; forecast: ForecastPoint[]; method: string }
// changePct: latest month vs. the month before (share of postings if the source states the sample size)
export interface DemandResponse { role: Role; current: number; changePct: number; series: Point[]; source: SourceRef; shareSeries?: Point[] | null; trend?: Trend | null }
export interface SkillRow { skill: string; share: number; changePct: number; source: SourceRef; trend?: Trend | null }
// role.id 'all' = counted over all IT postings, not per role
export interface SkillsResponse { role: Role; skills: SkillRow[] }
export interface Employer { name: string; openings: number; topSkill: string }
export interface EmployersResponse { role: Role; employers: Employer[]; source: SourceRef }
export interface TargetGroupResponse { groups: { label: string; count: number }[]; source: SourceRef }
export interface PolicyItem { title: string; summary: string; date: string; source: SourceRef }
export interface PolicyResponse { items: PolicyItem[] }
export interface SubscribeBody { email: string; roleIds: string[] }
export interface SourceStatus { id: string; name: string; url: string; lastFetchedAt: string; dataAsOf?: string | null; licence?: string | null; licenceUrl?: string | null; status: 'ok' | 'stale' | 'error'; problem?: string | null }

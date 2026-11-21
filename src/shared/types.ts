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
export interface PolicyItem { title: string; summary: string; date: string; source: SourceRef }
export interface PolicyResponse { items: PolicyItem[] }
export interface SubscribeBody { email: string; roleIds: string[] }
export interface SourceStatus { id: string; name: string; url: string; lastFetchedAt: string; dataAsOf?: string | null; licence?: string | null; licenceUrl?: string | null; status: 'ok' | 'stale' | 'error'; problem?: string | null }

// Frozen contract for the config-driven connectors (docs/market-item.schema.json).
// Field names stay snake_case to match the JSON Schema and the Python schemas.
export type MarketItemCategory = 'A' | 'B' | 'C' | 'D' | 'E';
export type MarketItemMetrics = Record<string, number | null>;
export interface MarketItem {
  id: string;
  /** Primary category, used for filtering (A-E). */
  category: MarketItemCategory;
  /** All categories the source feeds; always contains `category`. */
  categories: MarketItemCategory[];
  title: string;
  summary: string;
  metrics: MarketItemMetrics;
  /** Tags and skills, e.g. "role:IT Support". */
  tags: string[];
  /** Canton code (ZH, BE, ...) when the record mentions a target city, else null. */
  region: string | null;
  source_name: string;
  source_url: string;
  /** Permalink of the single record, null for aggregates. */
  url: string | null;
  published_at: string | null;
  /** When the connector retrieved the data. */
  fetched_at: string;
}

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
export interface Employer { name: string; openings: number; topSkills: string[]; sourceUrl?: string | null }
// window: the posting period the numbers come from (YYYY-MM-DD), null when the source gives no dates
export interface EmployersResponse { role: Role; window: { from: string; to: string } | null; employers: Employer[]; source: SourceRef }
export interface SourceStatus { id: string; name: string; url: string; lastFetchedAt: string; dataAsOf?: string | null; licence?: string | null; licenceUrl?: string | null; status: 'ok' | 'stale' | 'error'; problem?: string | null }

// ---- Level 2: briefings ----------------------------------------------------
// One bullet = one fact plus the source it came from. The backend appends the citation line, never the model.
export interface DigestBullet { text: string; source: SourceRef }
export interface DigestSection { heading: string; bullets: DigestBullet[]; note?: string | null }
export interface Digest { subject: string; text: string; sections: DigestSection[]; sources: SourceRef[]; generatedAt: string; empty: boolean }
export interface DigestRequest { roleIds: string[]; includePolicy: boolean; includeTargetGroup: boolean }
export interface SubscribeBody extends DigestRequest { email: string; cadence: 'weekly' | 'monthly' }
export interface SubscribeResult { ok: boolean; sent: boolean; error?: string | null; nextRun?: string | null; unsubscribeUrl?: string | null }
export interface SendOutcome { subscriptionId: string; email: string; status: 'sent' | 'dry_run' | 'error' | 'skipped'; detail?: string | null }
export interface RunResult { sent: number; failed: number; skipped: number; results: SendOutcome[] }

// ---- Level 4: config-driven connectors ------------------------------------
export interface ConnectorSource {
  id: string; name: string; description: string; sourceUrl: string; categories: string[];
  adapterType: 'rest_api' | 'rss_atom' | 'csv_url'; endpoints: string[]; refreshRate: string;
  refreshSeconds: number | null; enabled: boolean; inConfig: boolean; authEnv: string[];
  filterKeywords: string[]; licence?: string | null; licenceUrl?: string | null;
  lastSyncAt?: string | null; lastError?: string | null; itemCount: number;
}
export interface ConnectorDefaults { targetCities: string[]; targetRoles: string[]; policyKeywords: string[] }
export interface ConnectorList {
  configFile: string; configError?: string | null; pendingChanges: boolean; appliedAt?: string | null;
  defaults: ConnectorDefaults; sources: ConnectorSource[];
}
export interface SyncResult { source: string; adapter: string; items: number; skipped: boolean; replaced: boolean; reason?: string | null; error?: string | null }
export interface SyncSummary { results: SyncResult[]; items: number; errors: number }
export interface ConnectorConfigFile { file: string; sha256: string; content: string }
export interface ConnectorConfigUpdate {
  file: string; sha256: string; added: number; updated: number; disabled: number;
  sourceCount: number; errors: string[]; persistent: boolean;
}

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

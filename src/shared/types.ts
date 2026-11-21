// fetchedAt: when we last retrieved data (ISO 8601). dataAsOf: the publisher's last update (YYYY-MM-DD), if known.
// comparableFrom: YYYY-MM, the source changed how it counts; earlier months are not comparable
export interface SourceRef { id: string; name: string; url: string; fetchedAt: string; dataAsOf?: string | null; comparableFrom?: string | null; datasetUrl?: string | null; datasetModified?: string | null }
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
export interface SourceStatus { id: string; name: string; url: string; lastFetchedAt: string; dataAsOf?: string | null; datasetUrl?: string | null; datasetModified?: string | null; licence?: string | null; licenceUrl?: string | null; status: 'ok' | 'stale' | 'error'; problem?: string | null }

// ---- Insights: our plain-language reading of a number or an item -----------
// Evidence is the only place numbers may come from: the text never introduces a number
// that is not also listed there with its source. `method` is 'template' — a deterministic
// sentence, not a model. `note`-style text is always labelled as our reading, never the source.
export type InsightKind = 'demand' | 'skills' | 'employers' | 'regions' | 'target' | 'policy';
export interface Evidence { label: string; value: string; source: SourceRef }
export interface Insight {
  id: string;
  kind: InsightKind;
  headline: string;
  body: string;
  evidence: Evidence[];
  severity: 'info' | 'attention';
  method: 'template';
  generatedAt: string;
  roleId?: string | null;
  itemId?: string | null;
}
// The weekly pulse on the home page. `postings` uses the sample size of all postings,
// never the sum of role counts (one posting can count for several roles).
export interface PulsePostings { value: number; period: string; base: number | null; source: SourceRef }
export interface PulseMover { role: Role; changePct: number; current: number; source: SourceRef }
export interface SourceHealth { ok: number; stale: number; error: number }
export interface Overview {
  generatedAt: string;
  postings: PulsePostings | null;
  rolesTracked: number;
  biggestRiser: PulseMover | null;
  biggestFaller: PulseMover | null;
  newPolicyItems: number;
  targetGroupItems: number;
  sources: SourceHealth;
  insights: Insight[];
}
// Curated product knowledge, served so the app and the e-mailed briefing tell the same story.
export interface Taxonomy { policyGroups: PolicyGroup[]; policyNotes: PolicyNote[]; roleAliases: Record<string, string[]> }

// ---- LLM explanations (docs/LLM.md) ---------------------------------------
// The model only writes the wording; numbers and citations are validated against the
// server-built facts, and `method` tells the UI whether the text came from the model
// or from the deterministic fallback.
export type ExplainKind = 'insight' | 'policy' | 'item';
export interface LlmStatus {
  enabled: boolean;
  provider: string;
  model: string;
  language: string;
  promptVersion: string;
  dailyCap: number;
  remainingTokens: number;
  disclaimer: string;
}
export interface ExplainRequest {
  kind: ExplainKind;
  insightId?: string | null;
  itemId?: string | null;
  roleId?: string | null;
  language?: 'en' | 'de';
}
export interface ExplainTarget { kind: string; id: string; label: string }
export interface CitedSentence { text: string; sources: SourceRef[] }
export interface Explanation {
  target: ExplainTarget;
  language: string;
  text: string;
  sentences: CitedSentence[];
  method: 'model' | 'fallback';
  model?: string | null;
  cached: boolean;
  generatedAt: string;
  disclaimer: string;
  usedSources: SourceRef[];
}
export interface AskRequest { question: string; roleId?: string | null; language?: 'en' | 'de' }
export interface AskAnswer {
  question: string;
  text: string;
  sentences: CitedSentence[];
  method: 'model' | 'fallback' | 'no_data';
  usedSources: SourceRef[];
  followUps: string[];
  cached: boolean;
  model?: string | null;
  generatedAt: string;
  disclaimer: string;
}

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
export interface PolicyGroup { label: string; keywords: string[] }
export interface PolicyNote { keyword: string; label: string; note: string }
export interface ConnectorDefaults {
  targetCities: string[];
  targetRoles: string[];
  policyKeywords: string[];
  policyGroups: PolicyGroup[];
  roleAliases: Record<string, string[]>;
}
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

// ---- Level 3D: target group (Question D) ------------------------------------
// One headline figure of the SEM monthly tables, with the provenance of that record.
export interface ContextKpi {
  id: string;
  label: string;
  value: number;
  unit: string;
  secondary?: number | null;
  secondaryLabel?: string | null;
  /** Compared with the month before; null when no earlier month is stored (never guessed). */
  changePct?: number | null;
  /** "What this measures", shown in the source popover. */
  note?: string | null;
  source: SourceRef;
}
export interface TargetGroupContext {
  /** null = Switzerland-wide. */
  region: string | null;
  /** YYYY-MM of the newest record, null when nothing is stored. */
  period: string | null;
  kpis: ContextKpi[];
  /** Indicators without a stored record, never filled with an estimate. */
  missing: string[];
  stale: boolean;
}

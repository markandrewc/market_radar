import type {
  AskAnswer, ConnectorConfigFile, ConnectorList, Digest, DigestRequest, DemandResponse, EmployersResponse, Evidence,
  ContextKpi, Explanation, ExplainRequest, Insight, InsightKind, LlmStatus, Overview, Role, SkillsResponse, SourceRef,
  SourceStatus, SubscribeBody, SubscribeResult, Taxonomy, TargetGroupContext,
} from '../../shared/types';

// Demo data for designing and testing the screens. Clearly labelled, never presented as real.
export type Scenario = 'normal' | 'empty' | 'short' | 'error';

const source: SourceRef = { id: 'demo', name: 'Demo data (not real)', url: 'https://example.com/demo-data', fetchedAt: '2026-11-21T09:00:00Z' };

const main = [
  { id: 'data-analyst', name: 'Data Analyst' },
  { id: 'it-support', name: 'IT Support' },
  { id: 'web-developer', name: 'Web Developer' },
];
// Extra demo roles, so the "all roles" list and its pagination can be tried (the real list can have hundreds).
const extraNames = ['Cloud Engineer', 'DevOps Engineer', 'QA Tester', 'Software Tester', 'Mobile Developer', 'Backend Developer', 'Frontend Developer',
  'Full Stack Developer', 'Database Administrator', 'Network Administrator', 'System Administrator', 'Security Analyst', 'UX Designer', 'UI Designer',
  'Product Owner', 'Scrum Master', 'Business Analyst', 'Data Engineer', 'Machine Learning Engineer', 'BI Developer', 'Technical Writer',
  'ERP Consultant', 'SAP Consultant', 'Java Developer', 'Python Developer', '.NET Developer', 'PHP Developer', 'Embedded Developer', 'Game Developer', 'IT Project Manager'];
const extra = extraNames.map((name) => ({ id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), name }));
export const roles: Role[] = [...main, ...extra];

const level: Record<string, [number, number]> = { 'web-developer': [1350, 0.15], 'it-support': [920, 0.06], 'data-analyst': [480, 0.09] };
extra.forEach((r, i) => { level[r.id] = [60 + ((i * 37) % 360), 0.05 + ((i * 7) % 12) / 100]; }); // always below the three main roles

function months(n: number): string[] {
  const out: string[] = [];
  let y = 2026, m = 11;
  for (let i = 0; i < n; i++) { out.unshift(`${y}-${String(m).padStart(2, '0')}`); if (--m === 0) { y--; m = 12; } }
  return out;
}

function series(roleId: string, n: number) {
  const [now, swing] = level[roleId];
  const all = months(36);
  return months(n).map((period) => {
    const i = all.indexOf(period);
    const wave = i < 11 ? 1.18 - i * 0.016 : i < 24 ? 1.0 - (i - 11) * 0.013 : 0.84 + (i - 24) * 0.007;
    return { period, value: Math.round(now * (1 + swing * (wave - 0.92)) * (1 + 0.02 * Math.sin(i * 1.7))) };
  });
}

export const mockRoles = (): Role[] => roles;

export const mockDemand = (scenario: Scenario = 'normal', n = 36): DemandResponse[] =>
  scenario === 'empty' ? [] : roles.map((role) => {
    const s = series(role.id, scenario === 'short' ? 1 : n);
    const first = s[0].value, last = s[s.length - 1].value;
    return { role, current: last, changePct: Math.round(((last - first) / first) * 1000) / 10, series: s, source };
  });

const skillShares: Record<string, [string, number, number][]> = {
  'web-developer': [['JavaScript', 66, 3], ['TypeScript', 57, 8], ['React', 46, 5], ['HTML', 42, -1], ['CSS', 40, 0], ['Git', 39, 2], ['Node.js', 32, 4], ['SQL', 29, -2], ['Java', 24, -3], ['Docker', 21, 6], ['Python', 16, 1]],
  'it-support': [['Windows', 62, 1], ['Microsoft 365', 55, 6], ['German', 52, 0], ['Active Directory', 44, -3], ['English', 41, 1], ['Networking', 38, 2], ['PowerShell', 30, 5], ['Microsoft Intune', 28, 7], ['ITIL', 24, -1], ['Azure', 20, 4], ['Linux', 18, -2]],
  'data-analyst': [['SQL', 74, 2], ['Excel', 60, -4], ['Python', 52, 7], ['Power BI', 44, 9], ['English', 38, 0], ['Statistics', 26, 1], ['Tableau', 22, -2], ['SAP', 18, 0], ['Artificial Intelligence', 16, 12], ['Azure', 14, 3], ['Machine Learning', 12, 5]],
};

export const mockSkills = (roleId = 'web-developer'): SkillsResponse => ({
  role: roles.find((r) => r.id === roleId) ?? roles[2],
  skills: (skillShares[roleId] ?? skillShares['web-developer']).map(([skill, share, changePct]) => ({ skill, share, changePct, source })),
});

export const mockEmployers = (roleId: string): EmployersResponse => ({
  role: roles.find((r) => r.id === roleId) ?? roles[2],
  window: { from: '2026-09-01', to: '2026-11-21' },
  employers: Array.from({ length: 8 }, (_, i) => ({
    name: `Demo company ${String.fromCharCode(65 + i)}`,
    openings: 8 - i,
    topSkills: i < 3 ? ['JavaScript', 'React', 'SQL'] : ['SQL', 'Excel'],
    sourceUrl: source.url,
  })),
  source,
});

/** One example briefing with the shape of the real e-mail, used in mock mode only. */
export const mockDigest = (request: DigestRequest = { roleIds: [], includePolicy: true, includeTargetGroup: true }): Digest => {
  const picked = request.roleIds.length ? roles.filter((r) => request.roleIds.includes(r.id)).slice(0, 3) : roles.slice(0, 2);
  return {
    subject: 'Market Radar: your weekly briefing (demo)',
    text: 'Demo briefing. In live mode every line names its source, the data date and a link.',
    generatedAt: new Date().toISOString(),
    empty: false,
    sources: [source],
    sections: [
      {
        heading: 'Demand',
        bullets: picked.map((r) => ({ text: `${r.name}: 1 role-specific figure and the change vs. last month.`, source })),
      },
      {
        heading: 'Skills',
        bullets: [
          { text: 'TypeScript is named in 57 % of postings (+8 % vs. last month).', source },
          { text: 'Docker is rising fastest, +6 %.', source },
        ],
        note: 'Demo note: in live mode this is our reading of the data, labelled as ours and never mixed with the source text.',
      },
      ...(request.includePolicy ? [{
        heading: 'Policy watch',
        bullets: [{ text: 'Demo: a new federal publication matches one of the policy keywords.', source }],
      }] : []),
    ],
  };
};

export const mockSubscribeResult = (_body: SubscribeBody): SubscribeResult => ({
  ok: true,
  sent: false,
  error: 'Demo mode: no e-mail is sent. Build with VITE_USE_MOCKS=0 and configure a mail provider (BREVO_API_KEY).',
  nextRun: null,
  unsubscribeUrl: null,
});

export const mockConnectors = (): ConnectorList => ({
  configFile: 'sources.yaml (demo)',
  configError: null,
  pendingChanges: false,
  appliedAt: source.fetchedAt,
  defaults: {
    targetCities: ['Zürich', 'Bern'], targetRoles: ['Web Developer', 'IT Support'], policyKeywords: ['Asyl'],
    policyGroups: mockTaxonomy().policyGroups, roleAliases: mockTaxonomy().roleAliases,
  },
  sources: [
    {
      id: 'demo_feed', name: 'Demo feed', description: 'Mock connector', sourceUrl: source.url,
      categories: ['E'], adapterType: 'rss_atom', endpoints: ['https://example.com/feed.xml'], refreshRate: 'daily',
      refreshSeconds: 86400, enabled: true, inConfig: true, authEnv: [], filterKeywords: [], itemCount: 12,
      lastSyncAt: source.fetchedAt, lastError: null,
    },
  ],
});

export const mockConnectorConfig = (): ConnectorConfigFile => ({
  file: 'sources.yaml (demo)',
  sha256: 'demo',
  content: '# Demo mode: the real sources.yaml is served by GET /api/connectors/config\nversion: 1\nsources: []\n',
});

const ago = (d: number) => new Date(new Date(source.fetchedAt).getTime() - d * 864e5).toISOString();
export const mockSources = (): SourceStatus[] => [
  { id: 'demo-a', name: 'Demo source A', url: source.url, lastFetchedAt: ago(1), status: 'ok' },
  { id: 'demo-b', name: 'Demo source B', url: source.url, lastFetchedAt: ago(60), status: 'stale' },
  { id: 'demo-c', name: 'Demo source C', url: source.url, lastFetchedAt: ago(200), status: 'error' },
];


// ---- Insights (template text, demo numbers) --------------------------------
const evidence = (label: string, value: string): Evidence => ({ label, value, source });

export const mockTaxonomy = (): Taxonomy => ({
  policyGroups: [
    { label: 'SEM numbers & distribution', keywords: ['Asylstatistik', 'Schutzstatus', 'Status S', 'Status F', 'Kantonsverteilung'] },
    { label: 'Migration law', keywords: ['Asyl', 'Ausländer', 'Migration', 'Aufenthalt', 'Einbürgerung'] },
    { label: 'Labour law & reporting', keywords: ['Arbeitsrecht', 'Stellenmeldepflicht', 'Erwerbstätigkeit', 'Berufsbildung'] },
  ],
  policyNotes: [
    { keyword: 'Status S', label: 'Protection status S: residence and work rights', note: 'Status S is temporary protection while an asylum case is open, not a settled residence permit. Working is possible under conditions set by the asylum decision and the canton, and the status can change when the case is decided — confirm the current permit before relying on it in a placement.' },
    { keyword: 'Status F', label: 'Status F: provisional admission and work permits', note: 'Status F is a provisional admission while removal is not possible. Taking up work normally needs an explicit permit that the employer requests through the cantonal migration office, so the waiting time belongs in the placement plan — check the current decision with the canton before promising a start date.' },
    { keyword: 'Stellenmeldepflicht', label: 'Job-reporting duty for posted vacancies', note: 'The Stellenmeldepflicht makes employers report vacancies in the occupations the rules list to the RAV before advertising them publicly. If it is extended, affected roles may appear later and through other channels; the duty sits with the employer, but it changes how soon we can see a vacancy.' },
    { keyword: 'Asyl', label: 'Asylum procedure changes', note: 'Changes to asylum procedure law can shorten or lengthen how long someone stays in the process, and with it their access to work and integration measures. Check the amendment’s entry into force before changing a participant’s plan; this summary does not say whether it already applies.' },
    { keyword: 'Integration', label: 'Integration funding', note: 'Integration funding usually covers language courses and placement support and is renewed per budget period. A change can shift which courses or programmes are free for participants in a canton, so confirm with the canton before promising a specific place.' },
    { keyword: 'Fachkräftemangel', label: 'Skills-shortage policy', note: 'Debates about the Fachkräftemangel often concern admission rules and quotas for professionals from outside the EU/EFTA. If a rule changes, it can affect which permits employers are willing to pursue, but it does not change the skills employers ask for today.' },
  ],
  roleAliases: {
    'AI Specialist': ['AI', 'Artificial Intelligence', 'Machine Learning', 'ML'],
    'Data Science': ['Data Scientist', 'Analytics', 'Machine Learning'],
    'IT Support': ['Helpdesk', 'Service Desk', 'First Level', 'Support Specialist'],
    'Web Developer': ['Frontend', 'Frontend Developer', 'Full Stack'],
    'Software Engineer': ['Backend', 'Backend Developer'],
    'Data Analyst': ['BI', 'Business Intelligence'],
  },
});

const generatedAt = '2026-11-21T09:00:00Z';

export const mockInsights = (filter: { role?: string; kind?: InsightKind; limit?: number } = {}): Insight[] => {
  const role = roles.find((r) => r.id === filter.role) ?? roles[2];
  const all: Insight[] = [
    {
      id: `demand:${role.id}`, kind: 'demand', roleId: role.id,
      headline: `${role.name}: demand is rising`,
      body: `${role.name} shows 1,350 open positions in November 2026, 4.2 % more than in October. The trend points up over the last months; treat the forecast as an extrapolation, not a promise.`,
      evidence: [evidence('Open positions, Nov 2026', '1,350'), evidence('Change vs. October', '+4.2 %')],
      severity: 'info', method: 'template', generatedAt,
    },
    {
      id: 'skills:all', kind: 'skills',
      headline: 'Two skills are gaining ground',
      body: 'TypeScript is named in 57 % of postings, 8 % more than last month. Docker is rising fastest. Skills falling back (Java, SQL) still appear in a third of the postings, so they stay in the curriculum.',
      evidence: [evidence('TypeScript, share of postings', '57 %'), evidence('Docker, change', '+6 %')],
      severity: 'info', method: 'template', generatedAt,
    },
    {
      id: 'regions:besta', kind: 'regions',
      headline: 'Zürich region leads, Espace Mittelland grows',
      body: 'In the latest quarter the Zürich region reports the most open positions. The Espace Mittelland grew fastest compared with the previous quarter. Regional figures are quarterly, so they move more slowly than the monthly national series.',
      evidence: [evidence('Open positions, Zürich region', '18,420'), evidence('Change, Espace Mittelland', '+3.1 %')],
      severity: 'info', method: 'template', generatedAt,
    },
    {
      id: 'target:latest', kind: 'target',
      headline: 'What the latest figures say about our target group',
      body: 'The newest published statistics show the number of people with protection status S and the cantonal distribution of new arrivals. Aggregate figures only; they say nothing about individual participants.',
      evidence: [evidence('Status S, latest month', '1,812')],
      severity: 'info', method: 'template', generatedAt,
    },
    {
      id: 'policy:latest', kind: 'policy', itemId: 'demo-policy',
      headline: 'A new publication touches Status S',
      body: 'A federal publication mentions protection status S and work rights. Our reading: check whether the change is already in force before promising a start date — the source text does not say it for you.',
      evidence: [evidence('Published', '2026-11-12')],
      severity: 'attention', method: 'template', generatedAt,
    },
  ];
  const filtered = filter.kind ? all.filter((i) => i.kind === filter.kind) : all;
  return filter.limit ? filtered.slice(0, filter.limit) : filtered;
};

export const mockOverview = (): Overview => ({
  generatedAt,
  postings: { value: 1350, period: '2026-11', base: 2200, source },
  rolesTracked: roles.length,
  biggestRiser: { role: roles[1], changePct: 8.2, current: 92, source },
  biggestFaller: { role: roles[0], changePct: -4.1, current: 64, source },
  newPolicyItems: 2,
  targetGroupItems: 6,
  sources: { ok: 2, stale: 1, error: 0 },
  insights: mockInsights(),
});


// ---- LLM explanations (demo: no provider is called) -------------------------
const llmDisclaimer = 'Our reading, not the source. Not legal advice — check the original.';

export const mockLlmStatus = (): LlmStatus => ({
  enabled: true,
  provider: 'deepseek (demo)',
  model: 'deepseek-flash',
  language: 'en',
  promptVersion: 'explain-v1',
  dailyCap: 200000,
  remainingTokens: 198400,
  disclaimer: llmDisclaimer,
});

export const mockExplanation = (request: ExplainRequest = { kind: 'insight' }): Explanation => ({
  target: {
    kind: request.kind,
    id: request.insightId ?? request.itemId ?? 'demo',
    label: request.kind === 'policy' ? 'Demo policy item' : 'Demo reading',
  },
  language: request.language ?? 'en',
  text: 'In plain words: this figure matters because it shows where the jobs are. The change is small and based on a sample, so treat it as a direction, not a promise. Check the source before making a decision.',
  sentences: [
    { text: 'In plain words: this figure matters because it shows where the jobs are.', sources: [source] },
    { text: 'The change is small and based on a sample, so treat it as a direction, not a promise.', sources: [source] },
    { text: 'Check the source before making a decision.', sources: [source] },
  ],
  method: 'model',
  model: 'deepseek-flash',
  cached: false,
  generatedAt,
  disclaimer: llmDisclaimer,
  usedSources: [source],
});

export const mockAskAnswer = (question: string): AskAnswer => {
  const noData = /world cup|weather|recipe|bitcoin/i.test(question);
  if (noData) {
    return {
      question,
      text: 'I do not have data on that in Market Radar. I can answer questions about the roles we track, the skills in the postings, employers, the target group and policy news.',
      sentences: [],
      method: 'no_data',
      usedSources: [],
      followUps: ['Which skills are rising for IT Support?', 'What is new in policy this week?'],
      cached: false,
      model: 'deepseek-flash',
      generatedAt,
      disclaimer: llmDisclaimer,
    };
  }
  return {
    question,
    text: 'The postings in our sample ask most often for SQL, Windows and Microsoft 365 for this role. The reading is based on the stored postings, not on a survey.',
    sentences: [
      { text: 'The postings in our sample ask most often for SQL, Windows and Microsoft 365 for this role.', sources: [source] },
      { text: 'The reading is based on the stored postings, not on a survey.', sources: [source] },
    ],
    method: 'model',
    usedSources: [source],
    followUps: ['Which roles are growing fastest?', 'What changed in policy this week?'],
    cached: false,
    model: 'deepseek-flash',
    generatedAt,
    disclaimer: llmDisclaimer,
  };
};


// ---- Level 3D: target group (demo figures, same shape as GET /api/target-group) ----
const targetSource = (id: string, name: string): SourceRef => ({
  id, name, url: source.url, fetchedAt: source.fetchedAt, dataAsOf: '2026-10-01',
});

const targetKpis = (region?: string): ContextKpi[] => {
  const factor = region ? 0.09 : 1; // one canton is roughly a tenth of the country, for the demo
  const scale = (value: number) => Math.round(value * factor);
  return [
    { id: 'asylum', label: 'Asylum applications', value: scale(2210), unit: 'persons',
      secondary: scale(1881), secondaryLabel: 'first applications', changePct: region ? null : 4.2,
      note: 'New asylum applications in the month, by canton of registration.',
      source: targetSource('demo-asylum', 'Demo data (not real) · 7-21') },
    { id: 'status-s', label: 'Requests for protection status S', value: scale(987), unit: 'persons',
      secondary: scale(932), secondaryLabel: 'protections granted', changePct: null,
      note: 'Requests, completed cases and protection grants for temporary protection (status S).',
      source: targetSource('demo-status-s', 'Demo data (not real) · 7-70') },
    { id: 'status-f', label: 'Provisionally admitted (status F)', value: scale(42151), unit: 'persons',
      secondary: 47.3, secondaryLabel: 'employment rate (%)', changePct: 0.8,
      note: 'People admitted provisionally and how many of them are employed.',
      source: targetSource('demo-status-f', 'Demo data (not real) · 6-22') },
    { id: 'immigration', label: 'Immigration of foreign residents', value: scale(17255), unit: 'persons',
      secondary: scale(16294), secondaryLabel: 'permit B', changePct: -1.4,
      note: 'Immigration of permanent foreign residents, by canton and month.',
      source: { ...targetSource('demo-immigration', 'Demo data (not real) · 3-25'),
        datasetUrl: 'https://opendata.swiss/de/dataset/offene-stellen-nach-grossregion7', datasetModified: '2026-11-20' } },
  ];
};

export const mockTargetGroup = (region?: string): TargetGroupContext => ({
  region: region ?? null,
  period: '2026-10',
  kpis: targetKpis(region),
  missing: [],
  stale: false,
});

import type {
  ConnectorConfigFile, ConnectorList, Digest, DigestRequest, DemandResponse, EmployersResponse, Role, SkillsResponse,
  SourceRef, SourceStatus, SubscribeBody, SubscribeResult,
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
  error: 'Demo mode: no e-mail is sent. Build with VITE_USE_MOCKS=0 and set RESEND_API_KEY.',
  nextRun: null,
  unsubscribeUrl: null,
});

export const mockConnectors = (): ConnectorList => ({
  configFile: 'sources.yaml (demo)',
  configError: null,
  pendingChanges: false,
  appliedAt: source.fetchedAt,
  defaults: { targetCities: ['Zürich', 'Bern'], targetRoles: ['Web Developer', 'IT Support'], policyKeywords: ['Asyl'] },
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

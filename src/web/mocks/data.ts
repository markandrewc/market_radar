import type {
  ConnectorConfigFile, ConnectorList, Digest, DigestRequest, DemandResponse, EmployersResponse, Role, SkillsResponse,
  SourceRef, SourceStatus, SubscribeBody, SubscribeResult,
} from '../../shared/types';

const source: SourceRef = {
  id: 'demo', name: 'Demo data (mock)', url: 'https://example.com', fetchedAt: new Date().toISOString(),
};
const roles: Role[] = [
  { id: 'web-dev', name: 'Web Developer' },
  { id: 'data-analyst', name: 'Data Analyst' },
  { id: 'it-support', name: 'IT Support' },
];

function series(seed: number) {
  let v = 100 + seed * 20;
  return Array.from({ length: 12 }, (_, i) => {
    v += Math.sin(i * 1.3 + seed) * 8 + 3;
    const d = new Date(2026, i, 1);
    return { period: d.toLocaleString('en', { month: 'short' }), value: Math.round(v) };
  });
}

export const mockRoles = (): Role[] => roles;

export const mockDemand = (): DemandResponse[] =>
  roles.map((role, i) => {
    const s = series(i);
    const first = s[0].value, last = s[s.length - 1].value;
    return { role, current: last, changePct: Math.round(((last - first) / first) * 100), series: s, source };
  });

export const mockSkills = (): SkillsResponse => ({
  role: roles[0],
  skills: [
    { skill: 'TypeScript', share: 62, changePct: 8, source },
    { skill: 'React', share: 58, changePct: 5, source },
    { skill: 'Node.js', share: 41, changePct: -2, source },
    { skill: 'SQL', share: 37, changePct: 3, source },
    { skill: 'Docker', share: 29, changePct: 11, source },
  ],
});

export const mockEmployers = (roleId: string): EmployersResponse => ({
  role: roles.find((r) => r.id === roleId) ?? roles[0],
  window: { from: '2026-09-01', to: '2026-11-21' },
  employers: [
    { name: 'Swisscom', openings: 24, topSkills: ['TypeScript', 'React', 'SQL'] },
    { name: 'SBB', openings: 18, topSkills: ['React', 'TypeScript'] },
    { name: 'UBS', openings: 15, topSkills: ['SQL', 'Python'] },
    { name: 'Migros', openings: 11, topSkills: ['Node.js', 'Linux'] },
  ],
  source,
});

const ago = (d: number) => new Date(Date.now() - d * 864e5).toISOString();
export const mockSources = (): SourceStatus[] => [
  { id: 'jobs', name: 'Job postings feed', url: 'https://example.com/jobs', lastFetchedAt: ago(1), status: 'ok' },
  { id: 'stats', name: 'Federal statistics', url: 'https://example.com/stats', lastFetchedAt: ago(9), status: 'stale' },
  { id: 'policy', name: 'Policy news', url: 'https://example.com/policy', lastFetchedAt: ago(30), status: 'error' },
];

export const mockDigest = (request: DigestRequest = { roleIds: [], includePolicy: true, includeTargetGroup: true }): Digest => {
  const picked = request.roleIds.length ? roles.filter((r) => request.roleIds.includes(r.id)) : roles.slice(0, 1);
  return {
    subject: 'Market Radar: your weekly update',
    text: 'Demo briefing. In live mode every line names its source, the data date and a link.',
    generatedAt: new Date().toISOString(),
    empty: false,
    sources: [source],
    sections: [
      {
        heading: 'Demand',
        bullets: picked.map((r) => ({ text: `${r.name}: ${(series(1)[11] ?? 0)} postings, +4.2 % vs. last month.`, source })),
      },
      {
        heading: 'Skills',
        bullets: [
          { text: 'TypeScript is named in 62 % of postings (+8 % vs. last month).', source },
          { text: 'Docker is rising fastest, +11 %.', source },
        ],
      },
    ],
  };
};

export const mockSubscribeResult = (body: SubscribeBody): SubscribeResult => ({
  ok: true,
  sent: false,
  error: 'Demo mode: no e-mail is sent. Build with VITE_USE_MOCKS=0 and set RESEND_API_KEY.',
  nextRun: null,
  unsubscribeUrl: null,
  ...(body.email ? {} : {}),
});

export const mockConnectors = (): ConnectorList => ({
  configFile: 'sources.yaml (demo)',
  configError: null,
  pendingChanges: false,
  appliedAt: new Date().toISOString(),
  defaults: { targetCities: ['Zürich', 'Bern'], targetRoles: ['Web Developer', 'IT Support'], policyKeywords: ['Asyl'] },
  sources: [
    {
      id: 'demo_feed', name: 'Demo feed', description: 'Mock connector', sourceUrl: 'https://example.com',
      categories: ['E'], adapterType: 'rss_atom', endpoints: ['https://example.com/feed.xml'], refreshRate: 'daily',
      refreshSeconds: 86400, enabled: true, inConfig: true, authEnv: [], filterKeywords: [], itemCount: 12,
      lastSyncAt: ago(1), lastError: null,
    },
  ],
});

export const mockConnectorConfig = (): ConnectorConfigFile => ({
  file: 'sources.yaml (demo)',
  sha256: 'demo',
  content: '# Demo mode: the real sources.yaml is served by GET /api/connectors/config\nversion: 1\nsources: []\n',
});

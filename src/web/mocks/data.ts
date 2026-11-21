import type { DemandResponse, SkillsResponse, SourceRef } from '../../shared/types';

const source: SourceRef = {
  id: 'demo', name: 'Demo data (mock)', url: 'https://example.com', fetchedAt: new Date().toISOString(),
};
const roles = [
  { id: 'web-dev', name: 'Web Developer' },
  { id: 'data-analyst', name: 'Data Analyst' },
  { id: 'cloud-eng', name: 'Cloud Engineer' },
];

function series(seed: number) {
  let v = 100 + seed * 20;
  return Array.from({ length: 12 }, (_, i) => {
    v += Math.sin(i * 1.3 + seed) * 8 + 3;
    const d = new Date(2026, i, 1);
    return { period: d.toLocaleString('en', { month: 'short' }), value: Math.round(v) };
  });
}

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

import type { EmployersResponse, PolicyResponse, SourceStatus, TargetGroupResponse } from '../../shared/types';

export const mockRoles = () => roles;

export const mockEmployers = (roleId: string): EmployersResponse => ({
  role: roles.find((r) => r.id === roleId) ?? roles[0],
  employers: [
    { name: 'Swisscom', openings: 24, topSkill: 'TypeScript' },
    { name: 'SBB', openings: 18, topSkill: 'React' },
    { name: 'UBS', openings: 15, topSkill: 'SQL' },
    { name: 'Migros', openings: 11, topSkill: 'Node.js' },
  ],
  source,
});

export const mockParticipants = (): TargetGroupResponse => ({
  groups: [
    { label: 'Open to full-time work', count: 120 },
    { label: 'Need German B1+', count: 48 },
    { label: 'Ready for internship', count: 36 },
  ],
  source,
});

export const mockPolicy = (): PolicyResponse => ({
  items: [
    { title: 'New funding for IT retraining', summary: 'Cantons expand support for career changers in digital roles.', date: '2026-10-28', source },
    { title: 'Skilled-worker quota update', summary: 'Permit quotas for IT specialists stay unchanged for 2027.', date: '2026-10-02', source },
  ],
});

const ago = (d: number) => new Date(Date.now() - d * 864e5).toISOString();
export const mockSources = (): SourceStatus[] => [
  { id: 'jobs', name: 'Job postings feed', url: 'https://example.com/jobs', lastFetchedAt: ago(1), status: 'ok' },
  { id: 'stats', name: 'Federal statistics', url: 'https://example.com/stats', lastFetchedAt: ago(9), status: 'stale' },
  { id: 'policy', name: 'Policy news', url: 'https://example.com/policy', lastFetchedAt: ago(30), status: 'error' },
];

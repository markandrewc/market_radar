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

import itboard from './itboard.json';
import roleSkills from './role-skills.json';

export interface MarketObservation {
  role_id: string;
  month: string;
  value: number;
  base: number | null;
  unit: string;
  source_url: string;
  data_cutoff: string | null;
  cutoff_source_url: string | null;
}

export interface MarketRole {
  id: string;
  label: string;
}

const marketSkillIds = ['python', 'security', 'docker'] as const;

export type MarketSkillId = typeof marketSkillIds[number];

export type SkillTrendObservation = Omit<MarketObservation, 'role_id'> & {
  skill_id: MarketSkillId;
};

export interface SkillSnapshot {
  source: string;
  read_on: string;
  base: number;
  skills: [label: string, count: number][];
  course: {
    title: string;
    practice: string;
    check: string;
  };
}

export interface MarketRadar {
  source: {
    name: string;
    url: string;
    report_index_url: string;
    licence: string;
    scope: string;
    fetched_at: string | null;
  };
  fetched_at: string | null;
  roles: MarketRole[];
  rows: MarketObservation[];
  totals: MarketObservation[];
  junior: MarketObservation[];
  skill_trends: SkillTrendObservation[];
}

export const radar: MarketRadar = {
  ...itboard,
  skill_trends: itboard.skill_trends.map((row) => {
    const skillId = marketSkillIds.find((id) => id === row.skill_id);
    if (!skillId) throw new Error('Unknown ITBoard skill ID');
    return { ...row, skill_id: skillId };
  }),
};

function parseSkill(row: (number | string)[]): SkillSnapshot['skills'][number] {
  const [label, count] = row;
  if (row.length !== 2 || typeof label !== 'string' || typeof count !== 'number') {
    throw new Error('Invalid ITBoard skill observation');
  }
  return [label, count];
}

export const skillsByRole: Readonly<Partial<Record<string, SkillSnapshot | null>>> = Object.fromEntries(
  Object.entries(roleSkills).map(([id, snapshot]) => [
    id,
    snapshot && { ...snapshot, skills: snapshot.skills.map(parseSkill) },
  ]),
);

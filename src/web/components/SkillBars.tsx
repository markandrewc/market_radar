import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type { SkillRow } from '../../shared/types';
import { cn } from '@/lib/utils';

function percent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded} %`;
}

function signedPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded)} %`;
}

/** Up/down/no change for one skill, with an arrow, the sign and colour. */
function ChangeChip({ pct }: { pct: number }) {
  if (pct === 0) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-line bg-brand-soft px-2 py-0.5 text-xs font-medium text-ink">
        <Minus className="h-3 w-3" aria-hidden />
        No change
        <span className="sr-only"> compared with the month before</span>
      </span>
    );
  }
  const up = pct > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium tnum',
        up ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-900',
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      <span className="sr-only">{up ? 'Up' : 'Down'} </span>
      {signedPercent(pct)}
      <span className="sr-only"> compared with the month before</span>
    </span>
  );
}

/**
 * Skills ranked by the share of job postings that mention them, as plain bars
 * (no chart library). Only the top `limit` skills are shown; default is 8.
 */
export function SkillBars({ skills, limit = 8 }: { skills: SkillRow[]; limit?: number }) {
  const ranked = [...skills].sort((a, b) => b.share - a.share).slice(0, Math.max(0, limit));
  if (ranked.length === 0) {
    return <p className="rounded-control bg-brand-soft p-3 text-sm text-ink-soft">No skill data for this role yet.</p>;
  }
  const maxShare = Math.max(...ranked.map((skill) => skill.share));

  return (
    <ul className="space-y-3" aria-label="Skills by share of job postings">
      {ranked.map((skill, index) => (
        <li key={skill.skill} className="space-y-1.5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <span className="flex min-w-0 items-baseline gap-2">
              <span className="w-4 shrink-0 text-xs font-semibold text-ink-soft tnum">{index + 1}</span>
              <span className="truncate text-sm font-medium text-ink">{skill.skill}</span>
            </span>
            <span className="text-sm text-ink-soft tnum">
              {percent(skill.share)} of postings
              <span className="sr-only">, ranked {index + 1} of {ranked.length}</span>
            </span>
          </div>
          <div className="flex items-center gap-2 pl-6">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line" aria-hidden>
              <div
                className="h-full rounded-full bg-linear-to-r from-brand-accent to-accent-deep"
                style={{ width: `${maxShare > 0 ? Math.max(0, Math.min(100, (skill.share / maxShare) * 100)) : 0}%` }}
              />
            </div>
            <ChangeChip pct={skill.changePct} />
          </div>
        </li>
      ))}
    </ul>
  );
}

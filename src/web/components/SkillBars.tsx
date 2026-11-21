import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import type { SkillRow } from '../../shared/types';
import { cn } from '@/lib/utils';

function percent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded} %`;
}

function signedPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? '+' : ''}${rounded} %`;
}

/** Up/down/no change for one skill, with an arrow, the sign and colour. */
function ChangeChip({ pct }: { pct: number }) {
  if (pct === 0) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs text-slate-700">
        <Minus className="h-3 w-3" aria-hidden />
        No change
        <span className="sr-only"> compared with the month before</span>
      </span>
    );
  }
  const up = pct > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium',
        up ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-900',
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
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
    return <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">No skill data for this role yet.</p>;
  }
  const maxShare = Math.max(...ranked.map((skill) => skill.share));

  return (
    <ul className="space-y-3" aria-label="Skills by share of job postings">
      {ranked.map((skill) => (
        <li key={skill.skill} className="space-y-1.5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <span className="text-sm font-medium text-brand">{skill.skill}</span>
            <span className="text-sm text-slate-700">{percent(skill.share)} of postings</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100" aria-hidden>
              <div
                className="h-full rounded-full bg-brand-accent"
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

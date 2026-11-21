import type { ReactNode } from 'react';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import type { Insight, SourceRef } from '../../shared/types';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { Interpretation } from './Interpretation';
import { SourceInfo } from './SourceInfo';
import { cn } from '@/lib/utils';

function signedPercent(pct: number): string {
  const rounded = Math.round(pct * 10) / 10;
  return `${rounded > 0 ? '+' : ''}${rounded} %`;
}

/** One headline number. The change badge always states the sign in text, never by colour alone. */
export function KpiCard({
  label,
  value,
  detail,
  changePct,
  insight,
  note,
  source,
  icon,
}: {
  label: string;
  value: ReactNode;
  detail?: string;
  changePct?: number;
  insight?: Insight;
  /** "What this measures", shown in the source popover. */
  note?: string;
  source?: SourceRef;
  /** Optional quiet glyph that anchors the card in its section. */
  icon?: ReactNode;
}) {
  return (
    <Card className="relative h-full overflow-hidden">
      {/* 2 px data accent: crisp on paper, gone the moment the card is hovered by nothing. */}
      <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-linear-to-r from-accent-soft to-brand-accent" />
      <CardContent className="flex h-full flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-soft">{label}</p>
          {icon && (
            <span aria-hidden className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-accent">
              {icon}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
          <span className="tnum text-4xl font-semibold tracking-tight text-ink sm:text-5xl">{value}</span>
          {changePct !== undefined && (
            <Badge
              variant="secondary"
              className={cn(
                'tnum rounded-full px-2.5 py-1 text-xs font-medium',
                changePct > 0
                  ? 'border-transparent bg-brand-soft text-ink'
                  : changePct < 0
                    ? 'border-transparent bg-accent-soft text-accent-deep'
                    : 'border-line bg-surface text-ink-soft',
              )}
            >
              {changePct > 0 ? (
                <TrendingUp className="h-3 w-3" aria-hidden />
              ) : changePct < 0 ? (
                <TrendingDown className="h-3 w-3" aria-hidden />
              ) : (
                <Minus className="h-3 w-3" aria-hidden />
              )}
              {changePct === 0 ? 'No change' : signedPercent(changePct)}
              <span className="sr-only"> compared with the month before</span>
            </Badge>
          )}
        </div>

        {detail && <p className="text-sm leading-relaxed text-ink-soft">{detail}</p>}
        {insight && <Interpretation insight={insight} />}
        {source && (
          <div className="mt-auto pt-1">
            <SourceInfo source={source} note={note} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

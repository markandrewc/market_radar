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
  source,
}: {
  label: string;
  value: ReactNode;
  detail?: string;
  changePct?: number;
  insight?: Insight;
  source?: SourceRef;
}) {
  return (
    <Card>
      <CardContent className="space-y-2 pt-5">
        <p className="text-sm font-medium text-slate-600">{label}</p>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-3xl font-semibold text-brand">{value}</span>
          {changePct !== undefined && (
            <Badge
              variant={changePct > 0 ? 'success' : changePct < 0 ? 'warning' : 'secondary'}
              className={cn('gap-1', changePct > 0 && 'text-emerald-800', changePct < 0 && 'text-amber-900')}
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
        {detail && <p className="text-sm text-slate-700">{detail}</p>}
        {insight && <Interpretation insight={insight} />}
        {source && <SourceInfo source={source} />}
      </CardContent>
    </Card>
  );
}

import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { DemandResponse } from '../../shared/types';
import { Card, CardContent } from './ui/card';
import { Change } from './Change';
import { Sparkline } from './Sparkline';
import { SourceBadge } from './SourceBadge';

/** A role as one editorial entry: name, the number, the trend, and where it comes from. */
export function RoleCard({ d }: { d: DemandResponse }) {
  return (
    <Card interactive className="h-full">
      <CardContent className="flex h-full flex-col gap-3 p-5">
        <h3 className="text-base font-semibold tracking-tight text-ink">
          <Link to={`/roles/${d.role.id}`} className="inline-flex items-center gap-1 underline-offset-4 transition-colors hover:text-brand-accent hover:underline">
            {d.role.name} <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </h3>

        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="tnum text-4xl font-semibold tracking-tight text-ink">{d.current}</span>
          <span className="text-sm text-ink-soft">open positions</span>
        </div>

        {d.series.length > 1 ? <div><Change pct={d.changePct} suffix={`over ${d.series.length} months`} /></div> : <p className="text-sm text-ink-soft">Not enough months yet to show a trend.</p>}

        <div className="mt-auto space-y-3 pt-1">
          <Sparkline series={d.series} />
          <div className="border-t border-line pt-3">
            <SourceBadge source={d.source} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

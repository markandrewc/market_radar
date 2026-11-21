import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { DemandResponse } from '../../shared/types';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Change } from './Change';
import { Sparkline } from './Sparkline';
import { SourceBadge } from './SourceBadge';

export function RoleCard({ d }: { d: DemandResponse }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle as="h3" className="text-base">
          <Link to={`/roles/${d.role.id}`} className="inline-flex items-center gap-1 font-semibold text-brand underline-offset-4 hover:text-brand-accent hover:underline">
            {d.role.name} <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-baseline gap-2"><span className="text-4xl font-semibold">{d.current}</span><span className="text-sm text-slate-600">open positions</span></div>
        {d.series.length > 1 ? <Change pct={d.changePct} suffix={`over ${d.series.length} months`} /> : <p className="text-sm text-slate-600">Not enough months yet to show a trend.</p>}
        <Sparkline series={d.series} />
        <SourceBadge source={d.source} />
      </CardContent>
    </Card>
  );
}

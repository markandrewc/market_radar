import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { DemandResponse } from '../../shared/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { SourceBadge } from './SourceBadge';
import { Change } from './Change';

export function DemandBlock({ data }: { data: DemandResponse }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Demand for {data.role.name}</CardTitle>
        <CardDescription>Job postings per month</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold">{data.current}</span>
          <Change pct={data.changePct} />
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.series}>
              <XAxis dataKey="period" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis tickLine={false} axisLine={false} fontSize={12} width={32} />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#a8324e" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <SourceBadge source={data.source} />
      </CardContent>
    </Card>
  );
}

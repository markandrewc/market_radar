import { useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { DemandResponse } from '../../shared/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Segmented } from './ui/segmented';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { SourceBadge } from './SourceBadge';
import { Change } from './Change';

export function monthLabel(period: string) {
  const [y, m] = period.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en', { month: 'short', year: '2-digit' });
}

type Range = '6' | '12' | 'all';

export function DemandBlock({ data }: { data: DemandResponse }) {
  const total = data.series.length;
  const [range, setRange] = useState<Range>(total > 12 ? '12' : 'all');
  const n = range === 'all' ? total : Math.min(total, Number(range));
  const series = data.series.slice(-n);
  const first = series[0]?.value ?? 0, last = series.at(-1)?.value ?? 0;
  const pct = first ? Math.round(((last - first) / first) * 1000) / 10 : 0;
  const summary = series.length > 1
    ? `From ${monthLabel(series[0].period)} to ${monthLabel(series.at(-1)!.period)}, open ${data.role.name} positions went from ${first} to ${last}.`
    : `Only ${monthLabel(series[0].period)} is available: ${last} open positions.`;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1.5">
            <CardTitle>How many {data.role.name} jobs are open</CardTitle>
            <CardDescription>The line shows the job postings found each month. The percentage compares the first and the last month shown.</CardDescription>
          </div>
          {total > 6 && (
            <Segmented label="Time range" value={range} onChange={setRange}
              options={[{ value: '6', label: '6 months' }, ...(total > 12 ? [{ value: '12' as Range, label: '12 months' }] : []), { value: 'all', label: `All (${total})` }]} />
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="text-4xl font-semibold text-brand">{last}</span>
          <span className="text-sm text-slate-600">open positions in the latest month</span>
          {series.length > 1 && <Change pct={pct} suffix={`over ${series.length} months`} />}
        </div>
        <p className="text-sm text-slate-700">{summary}</p>
        {series.length > 1 ? (
          <div className="h-60" role="img" aria-label={summary}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series.map((p) => ({ ...p, label: monthLabel(p.period) }))}>
                <CartesianGrid stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} minTickGap={24} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} width={40} />
                <Tooltip formatter={(v) => [`${v} open positions`, '']} separator="" />
                <Line type="monotone" dataKey="value" stroke="#a8324e" strokeWidth={2.5} dot={series.length <= 14 ? { r: 3 } : false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">We only have one month of data so far, so there is no trend to show yet.</p>
        )}
        <details className="rounded-md border border-slate-200 p-3">
          <summary className="cursor-pointer text-sm font-medium text-brand">Show the numbers as a table</summary>
          <div className="max-h-72 overflow-y-auto pt-2" tabIndex={0} role="region" aria-label="Table of monthly numbers">
            <Table>
              <TableCaption>Open {data.role.name} positions per month</TableCaption>
              <TableHeader><TableRow><TableHead>Month</TableHead><TableHead>Open positions</TableHead></TableRow></TableHeader>
              <TableBody>{[...series].reverse().map((p) => <TableRow key={p.period}><TableCell>{monthLabel(p.period)}</TableCell><TableCell>{p.value}</TableCell></TableRow>)}</TableBody>
            </Table>
          </div>
        </details>
        <SourceBadge source={data.source} />
      </CardContent>
    </Card>
  );
}

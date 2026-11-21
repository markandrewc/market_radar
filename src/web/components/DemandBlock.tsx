import { useId, useState } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { DemandResponse } from '../../shared/types';
import { CHART, axisProps, formatNumber, gridProps, tooltip } from '../charts/theme';
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

type Row = { period: string; value: number; label: string };

/** Tooltip on the warm card: month, value and the publisher the number comes from. */
function DemandTooltip({ active, payload, sourceName }: { active?: boolean; payload?: { payload?: Row }[]; sourceName: string }) {
  const row = payload?.find((entry) => entry.payload)?.payload;
  if (!active || !row) return null;
  return (
    <div className={tooltip.card}>
      <p className={tooltip.label}>{row.label}</p>
      <p className={`${tooltip.value} tnum`}>{formatNumber(row.value)} open positions</p>
      <p className={tooltip.note}>Source: {sourceName}</p>
    </div>
  );
}

export function DemandBlock({ data }: { data: DemandResponse }) {
  const gradientId = `demand-${useId().replace(/[:]/g, '')}`;
  const total = data.series.length;
  const [range, setRange] = useState<Range>(total > 12 ? '12' : 'all');
  const n = range === 'all' ? total : Math.min(total, Number(range));
  const series = data.series.slice(-n);
  const first = series[0]?.value ?? 0, last = series.at(-1)?.value ?? 0;
  const pct = first ? Math.round(((last - first) / first) * 1000) / 10 : 0;
  const summary = series.length > 1
    ? `From ${monthLabel(series[0].period)} to ${monthLabel(series.at(-1)!.period)}, open ${data.role.name} positions went from ${first} to ${last}.`
    : `Only ${monthLabel(series[0].period)} is available: ${last} open positions.`;
  const rows: Row[] = series.map((point) => ({ ...point, label: monthLabel(point.period) }));

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
          <span className="text-4xl font-semibold tracking-tight text-ink tnum sm:text-5xl">{formatNumber(last)}</span>
          <span className="text-sm text-ink-soft">open positions in the latest month</span>
          {series.length > 1 && <Change pct={pct} suffix={`over ${series.length} months`} />}
        </div>
        <p className="text-sm text-ink-soft">{summary}</p>
        {series.length > 1 ? (
          <div className="h-60" role="img" aria-label={summary}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART.accent} stopOpacity={0.18} />
                    <stop offset="100%" stopColor={CHART.accent} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="label" minTickGap={24} {...axisProps} />
                <YAxis width={44} {...axisProps} />
                <Tooltip content={<DemandTooltip sourceName={data.source.name} />} cursor={tooltip.cursor} />
                <Area type="monotone" dataKey="value" stroke="none" fill={`url(#${gradientId})`} isAnimationActive={false} activeDot={false} />
                <Line type="monotone" dataKey="value" stroke={CHART.accent} strokeWidth={2.5}
                  dot={series.length <= 14 ? { r: 3, strokeWidth: 0, fill: CHART.accent } : false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="rounded-control bg-brand-soft p-3 text-sm text-ink-soft">We only have one month of data so far, so there is no trend to show yet.</p>
        )}
        <details className="rounded-control border border-line p-3">
          <summary className="cursor-pointer text-sm font-medium text-ink">Show the numbers as a table</summary>
          <div className="max-h-72 overflow-y-auto pt-2" tabIndex={0} role="region" aria-label="Table of monthly numbers">
            <Table>
              <TableCaption>Open {data.role.name} positions per month</TableCaption>
              <TableHeader><TableRow><TableHead>Month</TableHead><TableHead>Open positions</TableHead></TableRow></TableHeader>
              <TableBody>{[...series].reverse().map((p) => <TableRow key={p.period}><TableCell>{monthLabel(p.period)}</TableCell><TableCell className="tnum">{formatNumber(p.value)}</TableCell></TableRow>)}</TableBody>
            </Table>
          </div>
        </details>
        <SourceBadge source={data.source} />
      </CardContent>
    </Card>
  );
}

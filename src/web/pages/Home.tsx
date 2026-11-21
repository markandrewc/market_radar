import { useState } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Link } from 'react-router-dom';
import type { Trend } from '../../shared/types';
import { useDemand, useSkills } from '../api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SourceBadge } from '@/components/SourceBadge';
import { Change } from '@/components/Change';
import { Empty, ErrorMsg, Loading } from '@/components/Status';

/** Small direction marker for a trend, shown only when the backend sends one. */
function TrendMark({ trend }: { trend?: Trend | null }) {
  if (!trend) return null;
  const text = trend.direction === 'rising' ? '↑ rising' : trend.direction === 'falling' ? '↓ falling' : '→ stable';
  const variant = trend.direction === 'rising' ? 'success' : trend.direction === 'falling' ? 'warning' : 'secondary';
  const slope = `${trend.slopePerMonth > 0 ? '+' : ''}${trend.slopePerMonth}/month, ${trend.months} months`;
  return (
    <Badge variant={variant} title={`${trend.basis === 'share' ? 'Share of postings' : 'Postings'}: ${slope}`}>
      {text}
    </Badge>
  );
}

export default function Home() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const demand = useDemand();
  // The selector defaults to the first role; a stale selection falls back to it.
  const activeId = demand.data?.find((entry) => entry.role.id === selectedId)?.role.id ?? demand.data?.[0]?.role.id;
  const skills = useSkills(activeId);

  if (demand.isLoading || skills.isLoading) return <Loading />;
  if (demand.error || skills.error || !demand.data || !skills.data) return <ErrorMsg />;
  if (demand.data.length === 0) return <Empty text="No data yet. Sync the sources in the Sources panel." />;

  const main = demand.data.find((entry) => entry.role.id === activeId) ?? demand.data[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-brand">Job market overview</h2>
          <p className="text-sm text-slate-500">Open positions in Switzerland, last 12 months</p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="home-role" className="text-sm text-slate-600">Role</label>
          <select
            id="home-role"
            value={main.role.id}
            onChange={(event) => setSelectedId(event.target.value)}
            className="rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-700"
          >
            {demand.data.map((entry) => (
              <option key={entry.role.id} value={entry.role.id}>{entry.role.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {demand.data.map((d) => (
          <Card key={d.role.id} className={d.role.id === main.role.id ? 'ring-1 ring-brand' : undefined}>
            <CardHeader>
              <CardTitle><Link to={`/roles/${d.role.id}`} className="hover:text-brand-accent">{d.role.name} →</Link></CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-semibold">{d.current}</span>
                <Change pct={d.changePct} />
              </div>
              <TrendMark trend={d.trend} />
              <SourceBadge source={d.source} />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>{main.role.name}: demand trend</CardTitle>
              <TrendMark trend={main.trend} />
            </div>
            <CardDescription>Job postings per month</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={main.series}>
                  <XAxis dataKey="period" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} width={32} />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke="#a8324e" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <SourceBadge source={main.source} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top skills asked for {main.role.name}</CardTitle>
            <CardDescription>Share of postings mentioning the skill</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {skills.data.skills.length === 0 ? (
              <p className="text-sm text-slate-500">
                No skill data for this role yet. Sync the sources in the{' '}
                <Link to="/sources" className="text-brand-accent underline">Sources panel</Link>.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Skill</TableHead>
                    <TableHead>Share</TableHead>
                    <TableHead>Change</TableHead>
                    <TableHead>Trend</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {skills.data.skills.map((s) => (
                    <TableRow key={s.skill}>
                      <TableCell className="font-medium">{s.skill}</TableCell>
                      <TableCell>{s.share}%</TableCell>
                      <TableCell><Change pct={s.changePct} /></TableCell>
                      <TableCell><TrendMark trend={s.trend} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {skills.data.skills[0] && <SourceBadge source={skills.data.skills[0].source} />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { useDemand, useSkills } from '../api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SourceBadge } from '@/components/SourceBadge';

function Change({ pct }: { pct: number }) {
  const up = pct >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <Badge variant={up ? 'success' : 'warning'}>
      <Icon className="mr-1 h-3 w-3" />
      {up ? '+' : ''}{pct}%
    </Badge>
  );
}

export default function Home() {
  const demand = useDemand();
  const skills = useSkills();

  if (demand.isLoading || skills.isLoading) return <p className="text-slate-500">Loading…</p>;
  if (demand.error || skills.error || !demand.data || !skills.data) return <p className="text-red-600">Something went wrong.</p>;

  if (demand.data.length === 0) return <p className="text-slate-500">No data yet.</p>;

  const main = demand.data[0];
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-brand">Job market overview</h2>
        <p className="text-sm text-slate-500">Open positions in Switzerland, last 12 months</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {demand.data.map((d) => (
          <Card key={d.role.id}>
            <CardHeader>
              <CardTitle>{d.role.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-semibold">{d.current}</span>
                <Change pct={d.changePct} />
              </div>
              <SourceBadge source={d.source} />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{main.role.name}: demand trend</CardTitle>
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
            <CardTitle>Top skills asked for</CardTitle>
            <CardDescription>Share of postings mentioning the skill</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Skill</TableHead><TableHead>Share</TableHead><TableHead>Change</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {skills.data.skills.map((s) => (
                  <TableRow key={s.skill}>
                    <TableCell className="font-medium">{s.skill}</TableCell>
                    <TableCell>{s.share}%</TableCell>
                    <TableCell><Change pct={s.changePct} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <SourceBadge source={skills.data.skills[0].source} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

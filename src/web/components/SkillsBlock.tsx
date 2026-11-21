import { useState } from 'react';
import type { SkillsResponse } from '../../shared/types';
import { usePaged } from '../hooks';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Pagination } from './ui/pagination';
import { Segmented } from './ui/segmented';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { SourceBadge } from './SourceBadge';
import { Change } from './Change';

type Filter = 'all' | 'rising' | 'falling';
const PAGE = 5;

export function SkillsBlock({ data }: { data: SkillsResponse }) {
  const [filter, setFilter] = useState<Filter>('all');
  const rising = data.skills.filter((s) => s.changePct > 0).length;
  const falling = data.skills.filter((s) => s.changePct < 0).length;
  const shown = data.skills.filter((s) => filter === 'all' || (filter === 'rising' ? s.changePct > 0 : s.changePct < 0));
  const paged = usePaged(shown, PAGE);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1.5">
            <CardTitle>Skills employers ask for most</CardTitle>
            <CardDescription>
              Share of {data.role.name} job postings that mention the skill. <strong>Rising</strong> means more postings mention it than last month.
            </CardDescription>
          </div>
          <Segmented label="Show skills" value={filter} onChange={(v) => { setFilter(v); paged.setPage(1); }}
            options={[{ value: 'all', label: `All (${data.skills.length})` }, { value: 'rising', label: `Rising (${rising})` }, { value: 'falling', label: `Falling (${falling})` }]} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {shown.length === 0 ? <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">No skills in this group this month.</p> : (
          <Table>
            <TableCaption>Skills for {data.role.name}, page {paged.page} of {paged.pageCount}</TableCaption>
            <TableHeader><TableRow><TableHead>Skill</TableHead><TableHead>Share of postings</TableHead><TableHead>Change vs. last month</TableHead></TableRow></TableHeader>
            <TableBody>
              {paged.slice.map((s) => (
                <TableRow key={s.skill}>
                  <TableCell className="font-medium">{s.skill}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 rounded bg-slate-100" aria-hidden><div className="h-2 rounded bg-brand-accent" style={{ width: `${Math.min(100, s.share)}%` }} /></div>
                      <span>{s.share}%</span>
                    </div>
                  </TableCell>
                  <TableCell><Change pct={s.changePct} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <Pagination label="Skills pages" page={paged.page} pageCount={paged.pageCount} total={paged.total} size={PAGE} onChange={paged.setPage} />
        {data.skills[0] && <SourceBadge source={data.skills[0].source} />}
      </CardContent>
    </Card>
  );
}

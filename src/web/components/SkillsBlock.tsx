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
              Share of {data.role.name} job postings that mention the skill. <strong className="font-semibold text-ink">Rising</strong> means more postings mention it than last month.
            </CardDescription>
          </div>
          <Segmented label="Show skills" value={filter} onChange={(v) => { setFilter(v); paged.setPage(1); }}
            options={[{ value: 'all', label: `All (${data.skills.length})` }, { value: 'rising', label: `Rising (${rising})` }, { value: 'falling', label: `Falling (${falling})` }]} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {shown.length === 0 ? <p className="rounded-control bg-brand-soft p-3 text-sm text-ink-soft">No skills in this group this month.</p> : (
          <Table>
            <TableCaption>Skills for {data.role.name}, page {paged.page} of {paged.pageCount}</TableCaption>
            <TableHeader><TableRow><TableHead>Skill</TableHead><TableHead>Share of postings</TableHead><TableHead>Change vs. last month</TableHead></TableRow></TableHeader>
            <TableBody>
              {paged.slice.map((s) => (
                <TableRow key={s.skill}>
                  <TableCell className="font-medium text-ink">{s.skill}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-line" aria-hidden>
                        <div className="h-full rounded-full bg-linear-to-r from-brand-accent to-accent-deep" style={{ width: `${Math.min(100, Math.max(0, s.share))}%` }} />
                      </div>
                      <span className="tnum text-ink-soft">{s.share}%</span>
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

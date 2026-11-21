import type { SkillsResponse } from '../../shared/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { SourceBadge } from './SourceBadge';
import { Change } from './Change';

export function SkillsBlock({ data }: { data: SkillsResponse }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top skills asked for</CardTitle>
        <CardDescription>Share of postings mentioning the skill</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Table>
          <TableHeader><TableRow><TableHead>Skill</TableHead><TableHead>Share</TableHead><TableHead>Change</TableHead></TableRow></TableHeader>
          <TableBody>
            {data.skills.map((s) => (
              <TableRow key={s.skill}>
                <TableCell className="font-medium">{s.skill}</TableCell>
                <TableCell>{s.share}%</TableCell>
                <TableCell><Change pct={s.changePct} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {data.skills[0] && <SourceBadge source={data.skills[0].source} />}
      </CardContent>
    </Card>
  );
}

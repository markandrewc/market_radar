import type { EmployersResponse } from '../../shared/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { SourceBadge } from './SourceBadge';

export function EmployersBlock({ data }: { data: EmployersResponse }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Who is hiring</CardTitle>
        <CardDescription>Employers with the most open positions</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Table>
          <TableHeader><TableRow><TableHead>Employer</TableHead><TableHead>Openings</TableHead><TableHead>Main skill</TableHead></TableRow></TableHeader>
          <TableBody>
            {data.employers.map((e) => (
              <TableRow key={e.name}>
                <TableCell className="font-medium">{e.name}</TableCell>
                <TableCell>{e.openings}</TableCell>
                <TableCell>{e.topSkill}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <SourceBadge source={data.source} />
      </CardContent>
    </Card>
  );
}

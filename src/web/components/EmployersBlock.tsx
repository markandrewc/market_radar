import type { EmployersResponse } from '../../shared/types';
import { usePaged } from '../hooks';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Pagination } from './ui/pagination';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { SourceBadge } from './SourceBadge';

const PAGE = 5;

export function EmployersBlock({ data }: { data: EmployersResponse }) {
  const hasSkill = data.employers.some((e) => e.topSkill);
  const paged = usePaged(data.employers, PAGE);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Who is hiring</CardTitle>
        <CardDescription>Employers seen with open positions. The number is the listings seen, not the employer's total.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Table>
          <TableCaption>Employers hiring for {data.role.name}, page {paged.page} of {paged.pageCount}</TableCaption>
          <TableHeader><TableRow><TableHead>Employer</TableHead><TableHead>Listings seen</TableHead>{hasSkill && <TableHead>Main skill</TableHead>}</TableRow></TableHeader>
          <TableBody>
            {paged.slice.map((e) => (
              <TableRow key={e.name}><TableCell className="font-medium">{e.name}</TableCell><TableCell>{e.openings}</TableCell>{hasSkill && <TableCell>{e.topSkill}</TableCell>}</TableRow>
            ))}
          </TableBody>
        </Table>
        <Pagination label="Employers pages" page={paged.page} pageCount={paged.pageCount} total={paged.total} size={PAGE} onChange={paged.setPage} />
        <SourceBadge source={data.source} />
      </CardContent>
    </Card>
  );
}

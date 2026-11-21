import { Link } from 'react-router-dom';
import type { EmployersResponse } from '../../shared/types';
import { usePaged } from '../hooks';
import { Badge } from './ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Pagination } from './ui/pagination';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { SourceBadge } from './SourceBadge';

const PAGE = 5;

/**
 * Who is hiring for one role. Counts are listings seen in the stored postings,
 * not an employer's total; the empty state names what to configure.
 */
export function EmployersBlock({ data }: { data: EmployersResponse }) {
  const paged = usePaged(data.employers, PAGE);
  const window = data.window ? `${data.window.from} to ${data.window.to}` : null;
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h3">Who is hiring</CardTitle>
        <CardDescription>
          Employers seen with open positions for {data.role.name}. The number is the listings we saw, not the employer's total.
          {window ? ` Postings from ${window}.` : ''}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.employers.length === 0 ? (
          <div className="space-y-2 rounded-md bg-slate-50 p-4 text-sm text-slate-700">
            <p className="font-medium text-brand">No employer data yet.</p>
            <p>
              Employer data comes from the Adzuna postings (category C). Set <code className="rounded bg-white px-1">ADZUNA_APP_ID</code>{' '}
              and <code className="rounded bg-white px-1">ADZUNA_APP_KEY</code>, then sync in the{' '}
              <Link to="/sources" className="text-brand-accent underline">Sources panel</Link>.
            </p>
          </div>
        ) : (
          <>
            <Table>
              <TableCaption>
                Employers hiring for {data.role.name}, page {paged.page} of {paged.pageCount}
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Employer</TableHead>
                  <TableHead>Listings seen</TableHead>
                  <TableHead>Main skills</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.slice.map((e) => (
                  <TableRow key={e.name}>
                    <TableCell className="font-medium">
                      {e.sourceUrl ? (
                        <a href={e.sourceUrl} target="_blank" rel="noreferrer" className="hover:text-brand-accent">
                          {e.name}
                        </a>
                      ) : (
                        e.name
                      )}
                    </TableCell>
                    <TableCell>{e.openings}</TableCell>
                    <TableCell>
                      <span className="flex flex-wrap gap-1">
                        {e.topSkills.length === 0 ? <span className="text-slate-500">–</span> : null}
                        {e.topSkills.map((skill) => <Badge key={skill} variant="outline">{skill}</Badge>)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination
              label="Employers pages"
              page={paged.page}
              pageCount={paged.pageCount}
              total={paged.total}
              size={PAGE}
              onChange={paged.setPage}
            />
            <SourceBadge source={data.source} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

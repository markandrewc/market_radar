import { Link } from 'react-router-dom';
import type { EmployersResponse } from '../../shared/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { SourceBadge } from './SourceBadge';

const day = (value: string) => new Date(value).toLocaleDateString('en-GB');

/** Level 3, category C: which employers are hiring for this role (Adzuna today). */
export function EmployersBlock({ data }: { data: EmployersResponse }) {
  const period = data.window ? `Postings from ${day(data.window.from)} to ${day(data.window.to)}` : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Who is hiring</CardTitle>
        <CardDescription>{period ?? 'Employers with the most open positions'}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.employers.length === 0 ? (
          <div className="space-y-2 rounded-md bg-brand-soft p-4 text-sm text-slate-700">
            <p>
              No employer data yet. Category C comes from Adzuna: set{' '}
              <code className="rounded bg-white px-1">ADZUNA_APP_ID</code> and{' '}
              <code className="rounded bg-white px-1">ADZUNA_APP_KEY</code>, then sync in the Sources panel.
            </p>
            <Link to="/sources" className="inline-block text-sm font-medium text-brand-accent underline">
              Open the Sources panel →
            </Link>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employer</TableHead>
                <TableHead>Openings</TableHead>
                <TableHead>Top skills</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.employers.map((employer) => (
                <TableRow key={employer.name}>
                  <TableCell className="font-medium">
                    {employer.name}
                    {employer.sourceUrl && (
                      <a
                        href={employer.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-2 text-xs font-normal text-brand-accent underline"
                      >
                        open postings
                      </a>
                    )}
                  </TableCell>
                  <TableCell>{employer.openings.toLocaleString('de-CH')}</TableCell>
                  <TableCell>
                    {employer.topSkills.length === 0 ? (
                      <span className="text-slate-400">–</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {employer.topSkills.map((skill) => (
                          <Badge key={skill} variant="outline">{skill}</Badge>
                        ))}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <SourceBadge source={data.source} />
      </CardContent>
    </Card>
  );
}

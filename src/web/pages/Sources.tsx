import { useSources } from '../api';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/PageHeader';
import { HowToAddSource } from '@/components/HowToAddSource';
import { Empty, ErrorMsg, Loading } from '@/components/Status';

const variant = { ok: 'success', stale: 'warning', error: 'default' } as const;
const label = { ok: 'Up to date', stale: 'Out of date', error: 'Problem' } as const;

export default function Sources() {
  const { data, isLoading, error } = useSources();
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorMsg />;
  return (
    <div className="space-y-6">
      <PageHeader title="Data sources" description="Every source behind the numbers, when it was last updated and whether it is up to date." />
      {data.length === 0 ? (
        <Empty text="No sources from the pipeline yet. Run `npm run pipeline` against this database." />
      ) : (
        <Card>
          <CardContent className="pt-5">
            <Table>
              <TableCaption>Data sources and their update status</TableCaption>
              <TableHeader><TableRow><TableHead>Source</TableHead><TableHead>Last update</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">
                      <a href={s.url} target="_blank" rel="noreferrer">{s.name}</a>
                      {s.licence && <p className="text-xs text-slate-600">{s.licence}</p>}
                    </TableCell>
                    <TableCell>
                      {new Date(s.lastFetchedAt).toLocaleDateString('en-GB')}
                      {s.dataAsOf && <p className="text-xs text-slate-600">data as of {s.dataAsOf}</p>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={variant[s.status]}>{label[s.status]}</Badge>
                      {s.problem && <p className="mt-1 max-w-xs text-xs text-slate-600">{s.problem}</p>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      <HowToAddSource />
    </div>
  );
}

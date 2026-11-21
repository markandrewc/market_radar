import { useSources } from '../api';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
      <h2 className="text-2xl font-semibold text-brand">Data sources</h2>
      {data.length === 0 ? (
        <Empty text="No sources from the pipeline yet. Run `npm run pipeline` against this database." />
      ) : (
        <Card>
          <CardContent className="pt-5">
            <Table>
              <TableHeader><TableRow><TableHead>Source</TableHead><TableHead>Last update</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">
                      <a href={s.url} target="_blank" rel="noreferrer">{s.name}</a>
                      {s.licence && <p className="text-xs text-slate-400">{s.licence}</p>}
                    </TableCell>
                    <TableCell>
                      {new Date(s.lastFetchedAt).toLocaleDateString('en-GB')}
                      {s.dataAsOf && <p className="text-xs text-slate-400">data as of {s.dataAsOf}</p>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={variant[s.status]}>{label[s.status]}</Badge>
                      {s.problem && <p className="mt-1 max-w-xs text-xs text-slate-500">{s.problem}</p>}
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

import { useSources } from '../api';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { HowToAddSource } from '@/components/HowToAddSource';
import { ErrorMsg, Loading } from '@/components/Status';

const variant = { ok: 'success', stale: 'warning', error: 'default' } as const;
const label = { ok: 'Up to date', stale: 'Out of date', error: 'Problem' } as const;

export default function Sources() {
  const { data, isLoading, error } = useSources();
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorMsg />;
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold text-brand">Data sources</h2>
      <Card>
        <CardContent className="pt-5">
          <Table>
            <TableHeader><TableRow><TableHead>Source</TableHead><TableHead>Last update</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium"><a href={s.url} target="_blank" rel="noreferrer">{s.name}</a></TableCell>
                  <TableCell>{new Date(s.lastFetchedAt).toLocaleDateString('en-GB')}</TableCell>
                  <TableCell><Badge variant={variant[s.status]}>{label[s.status]}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <HowToAddSource />
    </div>
  );
}

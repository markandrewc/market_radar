import { useSources } from '../api';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/PageHeader';
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
      <PageHeader title="Data sources" description="Every source behind the numbers, when it was last updated and whether it is up to date." />
      <Card>
        <CardContent className="pt-5">
          <Table>
            <TableCaption>Data sources and their update status</TableCaption>
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

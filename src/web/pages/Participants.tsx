import { useParticipants } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SourceBadge } from '@/components/SourceBadge';
import { DemoNotice } from '@/components/DemoNotice';
import { ErrorMsg, Loading } from '@/components/Status';

export default function Participants() {
  const { data, isLoading, error } = useParticipants();
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorMsg />;
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold text-brand">Participants</h2>
      <DemoNotice />
      <div className="grid gap-4 sm:grid-cols-3">
        {data.groups.map((g) => (
          <Card key={g.label}>
            <CardHeader><CardTitle>{g.label}</CardTitle></CardHeader>
            <CardContent><span className="text-3xl font-semibold">{g.count}</span></CardContent>
          </Card>
        ))}
      </div>
      <SourceBadge source={data.source} />
    </div>
  );
}

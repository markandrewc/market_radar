import type { PolicyItem } from '../../shared/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { SourceBadge } from './SourceBadge';

export function PolicyCard({ item, as = 'h3' }: { item: PolicyItem; as?: 'h2' | 'h3' }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardDescription><time dateTime={item.date}>{new Date(item.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</time></CardDescription>
        <CardTitle as={as} className="text-base font-semibold text-brand">{item.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-slate-700">{item.summary}</p>
        <SourceBadge source={item.source} />
      </CardContent>
    </Card>
  );
}

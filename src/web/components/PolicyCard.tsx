import type { PolicyItem } from '../../shared/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { SourceBadge } from './SourceBadge';

export function PolicyCard({ item }: { item: PolicyItem }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base text-brand">{item.title}</CardTitle>
        <CardDescription>{new Date(item.date).toLocaleDateString('en-GB')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm">{item.summary}</p>
        <SourceBadge source={item.source} />
      </CardContent>
    </Card>
  );
}

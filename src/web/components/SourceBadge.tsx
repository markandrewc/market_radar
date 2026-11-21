import type { SourceRef } from '../../shared/types';
import { Badge } from './ui/badge';

export function SourceBadge({ source }: { source: SourceRef }) {
  const date = new Date(source.fetchedAt).toLocaleDateString('en-GB');
  return (
    <a href={source.url} target="_blank" rel="noreferrer">
      <Badge variant="outline">Source: {source.name} · {date}</Badge>
    </a>
  );
}

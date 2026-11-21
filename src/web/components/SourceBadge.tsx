import type { SourceRef } from '../../shared/types';
import { Badge } from './ui/badge';

/**
 * The provenance line for one number: who published it, when the publisher last
 * updated it (`dataAsOf`), when we retrieved it (`fetchedAt`) and the link the
 * team can click to check the original.
 */
export function SourceBadge({ source, compact = false }: { source: SourceRef; compact?: boolean }) {
  const fetched = new Date(source.fetchedAt).toLocaleDateString('en-GB');
  const asOf = source.dataAsOf ? new Date(source.dataAsOf).toLocaleDateString('en-GB') : null;
  const title = `${source.name} — data as of ${asOf ?? 'not stated'}, retrieved ${fetched}`;
  if (compact) {
    return (
      <a href={source.url} target="_blank" rel="noreferrer" title={title} className="text-xs text-slate-500 underline">
        {source.name} · {asOf ?? fetched}
      </a>
    );
  }
  return (
    <a href={source.url} target="_blank" rel="noreferrer" title={title} className="inline-block">
      <Badge variant="outline">
        Source: {source.name}
        {asOf ? ` · data as of ${asOf}` : ''} · retrieved {fetched}
      </Badge>
    </a>
  );
}

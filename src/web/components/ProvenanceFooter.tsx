import { ExternalLink } from 'lucide-react';
import type { SourceRef } from '../../shared/types';
import { SourceInfo } from './SourceInfo';
import { formatDate } from './SourceInfo';

/**
 * The standard footer under a chart or a card: which sources produced the
 * numbers, when we last fetched them and where the raw record lives. It is the
 * one place a reader can always find to check the original.
 */
export function ProvenanceFooter({
  sources,
  updatedAt,
  rawHref,
  rawLabel = 'Open the original',
  className,
}: {
  sources: SourceRef[];
  updatedAt?: string | null;
  rawHref?: string | null;
  rawLabel?: string;
  className?: string;
}) {
  const unique = Array.from(new Map(sources.map((source) => [source.id || source.url, source])).values());
  if (unique.length === 0 && !updatedAt) return null;
  return (
    <div className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line pt-3 ${className ?? ''}`}>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="kicker text-[10px]">{unique.length === 1 ? 'Source' : 'Sources'}</span>
        {unique.map((source) => (
          <SourceInfo key={source.id || source.url} source={source} />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {updatedAt && <span className="meta">Data as of {formatDate(updatedAt)}</span>}
        {rawHref && (
          <a
            href={rawHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-accent underline underline-offset-2 hover:text-accent-deep"
          >
            {rawLabel}
            <ExternalLink className="h-3 w-3" aria-hidden />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        )}
      </div>
    </div>
  );
}

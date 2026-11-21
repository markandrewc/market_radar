import { ExternalLink } from 'lucide-react';
import type { SourceRef } from '../../shared/types';
import { cn } from '@/lib/utils';

/**
 * The provenance line for one number: who published it, when the publisher last
 * updated it (`dataAsOf`), when we retrieved it (`fetchedAt`) and the link the
 * team can click to check the original.
 */
export function SourceBadge({ source, compact = false }: { source: SourceRef; compact?: boolean }) {
  const fetched = new Date(source.fetchedAt).toLocaleDateString('en-GB');
  const asOf = source.dataAsOf ? new Date(source.dataAsOf).toLocaleDateString('en-GB') : null;
  const label = `${source.name}${asOf ? `, data as of ${asOf}` : ''}, retrieved ${fetched}`;
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noreferrer"
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 text-xs text-ink-soft transition-colors hover:text-ink',
        compact
          ? 'underline decoration-line-strong underline-offset-4 hover:decoration-ink'
          : 'rounded-full border border-line bg-surface px-2.5 py-1 font-medium hover:border-line-strong',
      )}
      aria-label={`Source: ${label}. Opens in a new tab.`}
      title={`Source: ${label}`}
    >
      <span aria-hidden className="h-1 w-1 shrink-0 rounded-full bg-brand-accent" />
      <span className="truncate">
        {compact ? `${source.name} · ${asOf ?? fetched}` : `Source: ${source.name}${asOf ? ` · data as of ${asOf}` : ''} · retrieved ${fetched}`}
      </span>
      <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
    </a>
  );
}

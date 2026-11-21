import { ExternalLink } from 'lucide-react';
import type { SourceRef } from '../../shared/types';

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
      className={
        compact
          ? 'inline-flex max-w-full items-center gap-1 text-xs text-slate-600 underline underline-offset-2 hover:text-brand-accent'
          : 'inline-flex max-w-full items-center gap-1 rounded-md border border-slate-300 px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-50'
      }
      aria-label={`Source: ${label}. Opens in a new tab.`}
      title={`Source: ${label}`}
    >
      <span className="truncate">
        {compact ? `${source.name} · ${asOf ?? fetched}` : `Source: ${source.name}${asOf ? ` · data as of ${asOf}` : ''} · retrieved ${fetched}`}
      </span>
      <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
    </a>
  );
}

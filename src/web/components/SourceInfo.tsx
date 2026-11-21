import { ExternalLink } from 'lucide-react';
import type { SourceRef } from '../../shared/types';
import { cn } from '@/lib/utils';

/** Dates shown to the team always use the same readable form, e.g. "15 Nov 2026". */
export function formatDate(iso: string): string {
  // A date without a time ("2026-11-15") means a calendar day: read it as local
  // midnight so it never slips to the previous day in another time zone.
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Where one number comes from: a small badge that opens a native popover with the
 * publisher date, the day we retrieved it, an optional explanation of what the
 * number measures ("What this measures", the caller's `note`), and a real link to
 * the original page. Keyboard accessible through the native `<details>`/`<summary>`.
 */
export function SourceInfo({ source, note }: { source: SourceRef; note?: string }) {
  const asOf = source.dataAsOf ? formatDate(source.dataAsOf) : null;
  const retrieved = formatDate(source.fetchedAt);
  const badge = `Source: ${source.name}${asOf ? ` · data as of ${asOf}` : ''} · retrieved ${retrieved}`;

  return (
    <details className="group relative inline-block max-w-full text-left align-top">
      <summary
        title={badge}
        className={cn(
          'inline-flex max-w-full cursor-pointer list-none items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink-soft transition-colors',
          'hover:border-line-strong hover:text-ink',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent',
          '[&::-webkit-details-marker]:hidden',
        )}
      >
        <span aria-hidden className="h-1 w-1 shrink-0 rounded-full bg-brand-accent" />
        <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
        <span className="min-w-0 truncate">{badge}</span>
      </summary>
      <div className="absolute left-0 top-full z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-card border border-line bg-surface p-4 text-left text-xs text-ink-soft shadow-float">
        <p className="text-sm font-semibold text-ink">{source.name}</p>
        <dl className="mt-2.5 space-y-1.5">
          <div className="flex flex-wrap gap-x-1">
            <dt className="font-medium text-ink">Publisher date: </dt>
            <dd className="tnum">{asOf ?? 'The source does not state a date'}</dd>
          </div>
          <div className="flex flex-wrap gap-x-1">
            <dt className="font-medium text-ink">Retrieved by us: </dt>
            <dd className="tnum">{retrieved}</dd>
          </div>
        </dl>
        {note && (
          <div className="mt-3 border-t border-line pt-3">
            <p className="font-semibold text-ink">What this measures</p>
            <p className="mt-1 leading-relaxed">{note}</p>
          </div>
        )}
        <a
          href={source.url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1 font-medium text-brand-accent underline decoration-brand-accent/30 underline-offset-2 hover:text-accent-deep"
        >
          Open {source.name} in a new tab
          <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
        </a>
        {source.datasetUrl && (
          <a
            href={source.datasetUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1.5 flex items-center gap-1 font-medium text-brand-accent underline decoration-brand-accent/30 underline-offset-2 hover:text-accent-deep"
          >
            Dataset on opendata.swiss
            {source.datasetModified ? ` (catalogue updated ${formatDate(source.datasetModified)})` : ''}
            <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
          </a>
        )}
      </div>
    </details>
  );
}

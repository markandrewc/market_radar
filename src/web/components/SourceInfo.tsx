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
          'inline-flex max-w-full cursor-pointer list-none items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-50',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent',
          '[&::-webkit-details-marker]:hidden',
        )}
      >
        <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
        <span className="min-w-0 truncate">{badge}</span>
      </summary>
      <div className="absolute left-0 top-full z-30 mt-1 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-slate-200 bg-white p-3 text-left text-xs text-slate-700 shadow-lg">
        <p className="text-sm font-semibold text-brand">{source.name}</p>
        <dl className="mt-2 space-y-1">
          <div>
            <dt className="inline font-medium text-slate-800">Publisher date: </dt>
            <dd className="inline">{asOf ?? 'The source does not state a date'}</dd>
          </div>
          <div>
            <dt className="inline font-medium text-slate-800">Retrieved by us: </dt>
            <dd className="inline">{retrieved}</dd>
          </div>
        </dl>
        {note && (
          <div className="mt-2 border-t border-slate-100 pt-2">
            <p className="font-semibold text-slate-800">What this measures</p>
            <p className="mt-0.5">{note}</p>
          </div>
        )}
        <a
          href={source.url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1 font-medium text-brand-accent underline underline-offset-2 hover:text-brand"
        >
          Open {source.name} in a new tab
          <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
        </a>
      </div>
    </details>
  );
}

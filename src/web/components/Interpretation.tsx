import { Compass, ExternalLink } from 'lucide-react';
import type { ExplainRequest, Insight } from '../../shared/types';
import { cn } from '@/lib/utils';
import { ExplainPanel } from './Explain';
import { formatDate } from './SourceInfo';

/**
 * Our plain-language reading of a number or an item. The text is always labelled
 * as our reading, never as the publisher's, and every number in it is repeated in
 * the evidence list with a link to the source it came from. When `explain` is set,
 * the caller may also ask the server for a shorter AI-written reading of the same
 * insight; that panel is clearly separated from our deterministic text.
 */
export function Interpretation({
  insight,
  explain,
  className,
}: {
  insight: Insight;
  explain?: ExplainRequest | null;
  className?: string;
}) {
  return (
    <div className={cn('rounded-lg border border-amber-200 bg-amber-50 p-4', className)}>
      <div className="flex items-start gap-2">
        <Compass className="mt-0.5 h-5 w-5 shrink-0 text-amber-800" aria-hidden />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className="text-sm font-semibold text-brand">What this means for Powercoders</h3>
            <span className="rounded border border-amber-300 bg-white px-1.5 py-0.5 text-[11px] font-medium text-amber-900">
              Our reading, not the source
            </span>
            {explain && <ExplainPanel target={explain} fallbackText={insight.body} />}
          </div>
          <p className="text-sm text-slate-800">{insight.body}</p>
          {insight.evidence.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">The numbers behind this</p>
              <ul className="mt-1 space-y-1">
                {insight.evidence.map((evidence, index) => {
                  const asOf = evidence.source.dataAsOf ? formatDate(evidence.source.dataAsOf) : null;
                  const retrieved = formatDate(evidence.source.fetchedAt);
                  return (
                    <li key={`${evidence.label}-${index}`} className="flex flex-wrap items-baseline gap-x-1 text-sm text-slate-700">
                      <span className="font-medium text-slate-800">{evidence.label}:</span>
                      <span>{evidence.value}</span>
                      <span aria-hidden>·</span>
                      <a
                        href={evidence.source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 break-words text-brand-accent underline underline-offset-2 hover:text-brand"
                      >
                        <span>
                          {evidence.source.name}
                          {asOf ? ` · data as of ${asOf}` : ''} · retrieved {retrieved}
                        </span>
                        <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

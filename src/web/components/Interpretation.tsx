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
    <div className={cn('relative overflow-hidden rounded-card border border-line bg-[#fbf6ee] py-4 pl-5 pr-4 sm:pl-6 sm:pr-5', className)}>
      {/* 3 px crimson rail: the panel is ours, not the publisher's. */}
      <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-brand-accent" />
      <div className="flex items-start gap-3">
        <span aria-hidden className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-brand-accent">
          <Compass className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {/* Kicker, not a headline: the panel is a reading, the number above it is the data. */}
            <h3 className="kicker">What this means for Powercoders</h3>
            <span className="inline-flex items-center rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink-soft">
              Our reading, not the source
            </span>
            {explain && <ExplainPanel target={explain} fallbackText={insight.body} />}
          </div>
          <p className="text-[15px] leading-relaxed text-ink">{insight.body}</p>
          {insight.evidence.length > 0 && (
            <div className="space-y-1.5 pt-0.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">The numbers behind this</p>
              <ul className="flex flex-wrap gap-1.5">
                {insight.evidence.map((evidence, index) => {
                  const asOf = evidence.source.dataAsOf ? formatDate(evidence.source.dataAsOf) : null;
                  const retrieved = formatDate(evidence.source.fetchedAt);
                  return (
                    <li key={`${evidence.label}-${index}`} className="flex max-w-full flex-wrap items-baseline gap-x-1.5 gap-y-1 text-sm text-ink">
                      <span className="font-medium text-ink">{evidence.label}:</span>
                      <span className="tnum">{evidence.value}</span>
                      <span aria-hidden className="text-ink-soft">·</span>
                      <a
                        href={evidence.source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex max-w-full items-center gap-1 rounded-control border border-line bg-surface px-2 py-0.5 text-xs text-ink-soft underline decoration-line-strong underline-offset-2 transition-colors hover:border-line-strong hover:text-ink hover:decoration-ink"
                      >
                        <span className="break-words">
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

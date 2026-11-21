import { Compass } from 'lucide-react';
import type { ExplainRequest, MarketItem, PolicyNote } from '../../shared/types';
import { formatDate, itemSource } from '../lib/source';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { ExplainPanel } from './Explain';
import { SourceBadge } from './SourceBadge';

const SUMMARY_LIMIT = 300;
const NEW_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Trim to roughly one paragraph without cutting a word in half. */
function trimSummary(summary: string): string {
  const text = summary.trim();
  if (text.length <= SUMMARY_LIMIT) return text;
  const cut = text.slice(0, SUMMARY_LIMIT);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > SUMMARY_LIMIT * 0.5 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** True when the publisher's date is in the last seven days (a period start is not "new"). */
function isNewThisWeek(publishedAt: string | null): boolean {
  if (!publishedAt) return false;
  const published = Date.parse(publishedAt);
  if (Number.isNaN(published)) return false;
  const age = Date.now() - published;
  return age >= 0 && age < NEW_WEEK_MS;
}

/**
 * One policy item with its provenance. The optional `note` is our curated
 * reading, rendered apart from the publisher text and labelled as ours.
 */
export function PolicyCard({
  item,
  note,
  explain,
}: {
  item: MarketItem;
  note?: PolicyNote;
  explain?: ExplainRequest | null;
}) {
  // The record permalink when the source has one, otherwise the source's own page.
  const href = item.url ?? item.source_url;
  return (
    <Card interactive className="h-full">
      <CardContent className="flex h-full flex-col gap-3 p-5">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="kicker text-ink-soft">
              {item.published_at ? (
                <time dateTime={item.published_at}>{formatDate(item.published_at)}</time>
              ) : (
                'Publisher date not stated'
              )}
            </p>
            {isNewThisWeek(item.published_at) && (
              <Badge variant="secondary" className="rounded-full border-transparent bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent-deep">
                New this week
              </Badge>
            )}
          </div>
          <h3 className="text-lg font-semibold tracking-tight text-ink">
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="underline-offset-2 transition-colors hover:text-brand-accent hover:underline"
            >
              {item.title}
            </a>
          </h3>
        </div>

        {item.summary && <p className="text-[15px] leading-relaxed text-ink-soft">{trimSummary(item.summary)}</p>}

        {note && (
          <div className="relative overflow-hidden rounded-card border border-line bg-[#fbf6ee] px-3.5 py-3 pl-4">
            <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-brand-accent" />
            <div className="flex items-start gap-2.5">
              <span aria-hidden className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-brand-accent">
                <Compass className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">Our reading, not the source</p>
                <p className="text-sm font-semibold text-ink">{note.label}</p>
                <p className="text-[15px] leading-relaxed text-ink">{note.note}</p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-auto space-y-3 pt-1">
          <SourceBadge source={itemSource(item)} />
          {explain && <ExplainPanel target={explain} fallbackText={item.summary} />}
        </div>
      </CardContent>
    </Card>
  );
}

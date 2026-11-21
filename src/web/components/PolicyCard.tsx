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
    <Card className="h-full">
      <CardContent className="space-y-3 pt-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs text-slate-600">
              {item.published_at ? (
                <time dateTime={item.published_at}>{formatDate(item.published_at)}</time>
              ) : (
                'Publisher date not stated'
              )}
            </p>
            {isNewThisWeek(item.published_at) && <Badge variant="secondary">New this week</Badge>}
          </div>
          <h3 className="mt-1 text-base font-semibold text-brand">
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="underline-offset-2 hover:text-brand-accent hover:underline"
            >
              {item.title}
            </a>
          </h3>
        </div>

        {item.summary && <p className="text-sm text-slate-700">{trimSummary(item.summary)}</p>}

        {note && (
          <div className="rounded-md border-l-4 border-amber-400 bg-amber-50 px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Our reading, not the source</p>
            <p className="mt-1 text-xs font-medium text-slate-700">{note.label}</p>
            <p className="mt-1 text-sm text-slate-700">{note.note}</p>
          </div>
        )}

        <SourceBadge source={itemSource(item)} />

        {explain && <ExplainPanel target={explain} fallbackText={item.summary} />}
      </CardContent>
    </Card>
  );
}

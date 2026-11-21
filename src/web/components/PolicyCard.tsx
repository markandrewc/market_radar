import type { MarketItem } from '../../shared/types';
import type { PolicyNote } from '../lib/policy-watch';
import { formatDate, itemSource } from '../lib/source';
import { Card, CardContent } from './ui/card';
import { SourceBadge } from './SourceBadge';

const SUMMARY_LIMIT = 300;

/** Trim to roughly one paragraph without cutting a word in half. */
function trimSummary(summary: string): string {
  const text = summary.trim();
  if (text.length <= SUMMARY_LIMIT) return text;
  const cut = text.slice(0, SUMMARY_LIMIT);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > SUMMARY_LIMIT * 0.5 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * One policy item with its provenance. The optional `note` is our curated
 * reading, rendered apart from the publisher text and labelled as ours.
 */
export function PolicyCard({ item, note }: { item: MarketItem; note?: PolicyNote }) {
  // The record permalink when the source has one, otherwise the source's own page.
  const href = item.url ?? item.source_url;
  return (
    <Card className="h-full">
      <CardContent className="space-y-3 pt-5">
        <div>
          <p className="text-xs text-slate-600">
            {item.published_at ? (
              <time dateTime={item.published_at}>{formatDate(item.published_at)}</time>
            ) : (
              'Publisher date not stated'
            )}
          </p>
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="mt-1 block text-base font-semibold text-brand underline-offset-2 hover:text-brand-accent hover:underline"
          >
            {item.title}
          </a>
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
      </CardContent>
    </Card>
  );
}

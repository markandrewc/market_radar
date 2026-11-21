import type { MarketItem, SourceRef } from '../../shared/types';

/** A MarketItem's provenance, shaped like the SourceRef the other numbers use. */
export function itemSource(item: MarketItem): SourceRef {
  return {
    id: item.source_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    name: item.source_name,
    url: item.source_url,
    fetchedAt: item.fetched_at,
    // The publisher's date for this record; null when the record carries none.
    dataAsOf: item.published_at ? item.published_at.slice(0, 10) : null,
  };
}

/** The newest retrieval among the items, for the "data freshness" line. */
export function freshness(items: MarketItem[]): { fetchedAt: string; sourceName: string; url: string } | null {
  if (!items.length) return null;
  const newest = items.reduce((a, b) => (a.fetched_at >= b.fetched_at ? a : b));
  return { fetchedAt: newest.fetched_at, sourceName: newest.source_name, url: newest.source_url };
}

export const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString('en-GB') : '–');

/** `2026-11` / `2026-11-01` -> `Nov 2026` / `1 Nov 2026`, for compact source lines. */
export function formatPeriod(value?: string | null): string {
  if (!value) return '–';
  const date = new Date(value.length === 7 ? `${value}-01` : value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

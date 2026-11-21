import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { MarketItem } from '../../shared/types';
import { useItems } from '../api';
import { PageHeader } from '@/components/PageHeader';
import { PolicyCard } from '@/components/PolicyCard';
import { Empty, ErrorMsg, Loading } from '@/components/Status';
import { POLICY_WATCH, matchesKeyword, noteFor } from '../lib/policy-watch';
import { formatDate } from '../lib/source';

interface SourceGroup {
  name: string;
  items: MarketItem[];
  /** Newest publisher date in the group, '' when none of its items state one. */
  newest: string;
}

/** One section per source, newest publisher date first — inside the section too. */
function sourceGroups(items: MarketItem[]): SourceGroup[] {
  const groups = new Map<string, MarketItem[]>();
  for (const item of items) {
    const group = groups.get(item.source_name);
    if (group) group.push(item);
    else groups.set(item.source_name, [item]);
  }
  return [...groups.entries()]
    .map(([name, groupItems]) => {
      const sorted = [...groupItems].sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''));
      return { name, items: sorted, newest: sorted[0]?.published_at ?? '' };
    })
    .sort((a, b) => b.newest.localeCompare(a.newest) || a.name.localeCompare(b.name));
}

/** While a topic is filtered, show that topic's note; otherwise the first match wins. */
function noteForItem(item: MarketItem, activeKeyword: string) {
  if (activeKeyword) {
    const active = POLICY_WATCH.find((note) => note.keyword === activeKeyword);
    if (active && matchesKeyword(item, active.keyword)) return active;
  }
  return noteFor(item);
}

export default function Policy() {
  const [keyword, setKeyword] = useState('');
  const { data, isLoading, error } = useItems({ category: 'E', limit: 100 });

  if (isLoading) return <Loading />;
  if (error) return <ErrorMsg />;

  const allItems = data ?? [];
  const items = keyword ? allItems.filter((item) => matchesKeyword(item, keyword)) : allItems;
  const groups = sourceGroups(items);

  const header = (
    <PageHeader
      title="Policy news"
      description="New laws, motions and reporting duties that can change what we teach or who we can place."
    />
  );

  if (allItems.length === 0) {
    return (
      <div className="space-y-4">
        {header}
        <Empty text="No policy items are stored yet. Run the connector pipeline and sync the configured sources, then reload this page." />
        <p className="text-sm text-slate-600">
          Check the <Link to="/sources" className="font-medium text-brand underline">data sources</Link> for the last sync and errors, or
          browse <Link to="/items?category=E" className="font-medium text-brand underline">all category E items</Link>.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}
      <p className="text-xs text-slate-500">
        Notes marked “Our reading, not the source” are our own interpretation, not the publisher’s wording.
      </p>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter policy items by topic">
        <button
          type="button"
          onClick={() => setKeyword('')}
          aria-pressed={!keyword}
          className={`rounded-md border px-3 py-1 text-xs font-medium ${
            keyword ? 'border-slate-200 text-slate-600' : 'border-brand bg-brand text-white'
          }`}
        >
          All topics
        </button>
        {POLICY_WATCH.map((note) => (
          <button
            key={note.keyword}
            type="button"
            onClick={() => setKeyword(keyword === note.keyword ? '' : note.keyword)}
            aria-pressed={keyword === note.keyword}
            title={note.label}
            className={`rounded-md border px-3 py-1 text-xs font-medium ${
              keyword === note.keyword ? 'border-brand bg-brand text-white' : 'border-slate-200 text-slate-600'
            }`}
          >
            {note.keyword}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="space-y-2">
          <Empty text={`No policy item mentions “${keyword}” right now.`} />
          <button
            type="button"
            onClick={() => setKeyword('')}
            className="rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600"
          >
            Show all topics
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.name} aria-label={`Policy items from ${group.name}`} className="space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 pb-2">
                <h2 className="font-semibold text-brand">
                  <a
                    href={group.items[0].source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline-offset-2 hover:text-brand-accent hover:underline"
                  >
                    {group.name}
                  </a>
                </h2>
                <p className="text-xs text-slate-500">
                  {group.items.length} item(s) · newest {group.newest ? formatDate(group.newest) : 'date not stated'}
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {group.items.map((item) => (
                  <PolicyCard key={`${item.source_name}-${item.id}`} item={item} note={noteForItem(item, keyword)} />
                ))}
              </div>
            </section>
          ))}
          <p className="text-xs text-slate-500">
            {items.length} item(s) from {groups.length} source(s)
            {keyword ? ` matching “${keyword}”` : ''}.
          </p>
        </div>
      )}
    </div>
  );
}

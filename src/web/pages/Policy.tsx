import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { MarketItem, PolicyGroup, PolicyNote } from '../../shared/types';
import { useItems, useTaxonomy } from '../api';
import { usePaged } from '../hooks';
import { PageHeader } from '@/components/PageHeader';
import { PolicyCard } from '@/components/PolicyCard';
import { FilterPills } from '@/components/FilterPills';
import { Pagination } from '@/components/ui/pagination';
import { Empty, ErrorMsg, Loading } from '@/components/Status';
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

/** Case-insensitive match of any keyword in the publisher's title and summary. */
function mentions(item: MarketItem, keywords: string[]): boolean {
  const text = `${item.title} ${item.summary}`.toLowerCase();
  return keywords.some((keyword) => text.includes(keyword.toLowerCase()));
}

/**
 * The first curated note whose keyword appears in the item. The notes are OUR
 * plain-language reading, served by the taxonomy endpoint — never hardcoded here,
 * and never attributed to the publisher.
 */
function noteFor(item: MarketItem, notes: PolicyNote[]): PolicyNote | undefined {
  return notes.find((note) => mentions(item, [note.keyword]));
}

const ALL_TOPICS = '';
const PAGE = 8;

export default function Policy() {
  const [topic, setTopic] = useState<string>(ALL_TOPICS);
  const { data, isLoading, error } = useItems({ category: 'E', limit: 100 });
  const taxonomy = useTaxonomy();

  // The taxonomy (topics + our notes) is optional: if it is still loading, failed
  // or empty, the page shows every item without chips beyond "All topics" and
  // without notes — never a hardcoded copy of the curated texts.
  const policyGroups: PolicyGroup[] = taxonomy.data?.policyGroups ?? [];
  const policyNotes: PolicyNote[] = taxonomy.data?.policyNotes ?? [];

  const activeGroup = policyGroups.find((group) => group.label === topic);
  const allItems = data ?? [];
  const items = activeGroup ? allItems.filter((item) => mentions(item, activeGroup.keywords)) : allItems;
  // Pages hold 8 items in the order of the source sections; each page is regrouped by source.
  const ordered = sourceGroups(items).flatMap((group) => group.items);
  const paged = usePaged(ordered, PAGE);
  const groups = sourceGroups(paged.slice);

  const chooseTopic = (next: string) => {
    setTopic(next);
    paged.setPage(1);
  };

  const header = (
    <PageHeader
      title="Policy news"
      description="New laws, motions and reporting duties that can change what we teach or who we can place."
    />
  );

  if (isLoading) return <Loading />;
  if (error) return <ErrorMsg />;

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

  const chipOptions = [
    { value: ALL_TOPICS, label: 'All topics' },
    ...policyGroups.map((group) => ({ value: group.label, label: group.label })),
  ];

  return (
    <div className="space-y-6">
      {header}
      <p className="text-xs text-slate-500">
        Notes marked “Our reading, not the source” are our own interpretation, not the publisher’s wording.
      </p>

      <FilterPills
        label="Filter policy items by topic"
        options={chipOptions}
        value={activeGroup ? activeGroup.label : ALL_TOPICS}
        onChange={chooseTopic}
      />

      {items.length === 0 ? (
        <div className="space-y-2">
          <Empty text={`No policy item mentions “${activeGroup?.label ?? topic}” right now.`} />
          <button
            type="button"
            onClick={() => chooseTopic(ALL_TOPICS)}
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
                  {group.items.length} item(s) on this page · newest{' '}
                  {group.newest ? formatDate(group.newest) : 'date not stated'}
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {group.items.map((item) => (
                  <PolicyCard
                    key={`${item.source_name}-${item.id}`}
                    item={item}
                    note={noteFor(item, policyNotes)}
                    explain={{ kind: 'policy', itemId: item.id }}
                  />
                ))}
              </div>
            </section>
          ))}
          <Pagination
            label="Policy items pages"
            page={paged.page}
            pageCount={paged.pageCount}
            total={paged.total}
            size={PAGE}
            onChange={paged.setPage}
          />
          <p className="text-xs text-slate-500">
            {items.length} item(s) from {new Set(items.map((item) => item.source_name)).size} source(s)
            {activeGroup ? ` on “${activeGroup.label}”` : ''}.
          </p>
        </div>
      )}
    </div>
  );
}

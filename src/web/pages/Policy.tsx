import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import type { MarketItem, PolicyGroup, PolicyNote } from '../../shared/types';
import { useItems, useTaxonomy } from '../api';
import { usePaged } from '../hooks';
import { PageHeader } from '@/components/PageHeader';
import { PolicyCard } from '@/components/PolicyCard';
import { FilterPills } from '@/components/FilterPills';
import { Button } from '@/components/ui/button';
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

/** Quiet inline link in supporting sentences. */
const linkClass =
  'font-medium text-brand-accent underline decoration-brand-accent/30 underline-offset-2 transition-colors hover:text-accent-deep';

/** Quiet way back to the Level 3 hub the page belongs to. */
const backLinkClass =
  'inline-flex items-center gap-1.5 text-sm text-ink-soft underline decoration-line-strong underline-offset-4 transition-colors hover:text-ink hover:decoration-ink';

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
      kicker="LEVEL 3 · POLICY WATCH"
      title="Policy news"
      description="New laws, motions and reporting duties that can change what we teach or who we can place."
      actions={
        <Link to="/context" className={backLinkClass}>
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Part of the Level 3 overview
        </Link>
      }
    />
  );

  if (isLoading) {
    return (
      <div className="space-y-8">
        {header}
        <Loading />
      </div>
    );
  }
  if (error) {
    return (
      <div className="space-y-8">
        {header}
        <ErrorMsg />
      </div>
    );
  }

  if (allItems.length === 0) {
    return (
      <div className="space-y-8">
        {header}
        <Empty text="No policy items are stored yet. Run the connector pipeline and sync the configured sources, then reload this page." />
        <p className="text-sm text-ink-soft">
          Check the <Link to="/sources" className={linkClass}>data sources</Link> for the last sync and errors, or
          browse <Link to="/items?category=E" className={linkClass}>all category E items</Link>.
        </p>
      </div>
    );
  }

  const chipOptions = [
    { value: ALL_TOPICS, label: 'All topics' },
    ...policyGroups.map((group) => ({ value: group.label, label: group.label })),
  ];

  return (
    <div className="space-y-8">
      {header}

      <div className="space-y-4">
        <p className="text-xs leading-relaxed text-ink-soft">
          Notes marked “Our reading, not the source” are our own interpretation, not the publisher’s wording.
        </p>
        <FilterPills
          label="Filter policy items by topic"
          options={chipOptions}
          value={activeGroup ? activeGroup.label : ALL_TOPICS}
          onChange={chooseTopic}
        />
      </div>

      {items.length === 0 ? (
        <div className="space-y-4">
          <Empty text={`No policy item mentions “${activeGroup?.label ?? topic}” right now.`} />
          <Button variant="outline" size="sm" className="rounded-control" onClick={() => chooseTopic(ALL_TOPICS)}>
            Show all topics
          </Button>
        </div>
      ) : (
        <div className="space-y-10">
          {groups.map((group) => (
            <section key={group.name} aria-label={`Policy items from ${group.name}`} className="space-y-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-line pb-3">
                <h2 className="min-w-0">
                  <a
                    href={group.items[0].source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="kicker underline-offset-4 transition-colors hover:underline"
                  >
                    {group.name}
                  </a>
                </h2>
                <p className="tnum text-xs text-ink-soft">
                  {group.items.length} item(s) on this page · newest{' '}
                  {group.newest ? formatDate(group.newest) : 'date not stated'}
                </p>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
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

          <div className="space-y-3 border-t border-line pt-5">
            <Pagination
              label="Policy items pages"
              page={paged.page}
              pageCount={paged.pageCount}
              total={paged.total}
              size={PAGE}
              onChange={paged.setPage}
            />
            <p className="text-xs text-ink-soft">
              {items.length} item(s) from {new Set(items.map((item) => item.source_name)).size} source(s)
              {activeGroup ? ` on “${activeGroup.label}”` : ''}.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

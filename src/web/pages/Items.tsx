import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePaged } from '../hooks';
import { Pagination } from '@/components/ui/pagination';
import type { MarketItem, MarketItemCategory } from '../../shared/types';
import { useItems } from '../api';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Empty, ErrorMsg, Loading } from '@/components/Status';
import { cn } from '@/lib/utils';

const categories: { value: MarketItemCategory; label: string }[] = [
  { value: 'A', label: 'A · Demand' },
  { value: 'B', label: 'B · Skills' },
  { value: 'C', label: 'C · Employers' },
  { value: 'D', label: 'D · Population' },
  { value: 'E', label: 'E · Policy' },
];

/** One category pill: ink when active, paper outline otherwise — the pressed state is also announced. */
function categoryPill(active: boolean): string {
  return cn(
    'inline-flex min-h-9 shrink-0 items-center whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent',
    active
      ? 'border-ink bg-ink text-paper'
      : 'border-line bg-surface text-ink-soft hover:border-line-strong hover:bg-paper hover:text-ink',
  );
}

const selectClass =
  'min-h-9 rounded-control border border-line bg-surface px-3 py-1.5 text-sm text-ink transition-colors hover:border-line-strong';

function Metrics({ metrics }: { metrics: MarketItem['metrics'] }) {
  const entries = Object.entries(metrics).filter(([, value]) => value !== null).slice(0, 3);
  if (!entries.length) return <span className="text-ink-soft">–</span>;
  return (
    <span className="tnum text-ink-soft">
      {entries.map(([name, value]) => `${name}: ${Number(value).toLocaleString('de-CH')}`).join(' · ')}
    </span>
  );
}

const date = (value: string | null) => (value ? new Date(value).toLocaleDateString('en-GB') : '–');

const PAGE = 15;

export default function Items() {
  // Filters live in the URL, so a view can be linked or shown on a slide.
  const [params, setParams] = useSearchParams();
  const category = (params.get('category') ?? '').toUpperCase() as MarketItemCategory | '';
  const region = params.get('region') ?? '';
  const source = params.get('source') ?? '';
  const q = params.get('q') ?? '';

  const update = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next, { replace: true });
  };

  const { data, isLoading, error } = useItems({
    category: categories.some((entry) => entry.value === category) ? (category as MarketItemCategory) : undefined,
    region: region || undefined,
    source: source || undefined,
    q: q || undefined,
    limit: 200,
  });

  const rowsAll = data ?? [];
  const paged = usePaged(rowsAll, PAGE);
  const filterKey = `${category}|${region}|${source}|${q}`;
  useEffect(() => paged.setPage(1), [filterKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const regions = [...new Set((data ?? []).map((item) => item.region).filter(Boolean) as string[])].sort();
  const sources = [...new Set((data ?? []).map((item) => item.source_name))].sort();

  return (
    <div className="space-y-8">
      <PageHeader
        kicker="ALL RECORDS"
        title="Market items"
        description="Every configured source normalised into one record: category, canton, metrics, tags, date and source."
      />

      <Card>
        <CardContent className="space-y-4 p-4 pt-4 sm:p-5 sm:pt-5">
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter items by category">
            <button type="button" aria-pressed={!category} onClick={() => update({ category: '' })} className={categoryPill(!category)}>
              All categories
            </button>
            {categories.map((entry) => (
              <button
                key={entry.value}
                type="button"
                aria-pressed={category === entry.value}
                onClick={() => update({ category: entry.value })}
                className={categoryPill(category === entry.value)}
              >
                {entry.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
            <select
              value={region}
              onChange={(event) => update({ region: event.target.value })}
              className={selectClass}
              aria-label="Filter by canton"
            >
              <option value="">All cantons</option>
              {regions.map((canton) => <option key={canton} value={canton}>{canton}</option>)}
            </select>
            <select
              value={source}
              onChange={(event) => update({ source: event.target.value })}
              className={selectClass}
              aria-label="Filter by source"
            >
              <option value="">All sources</option>
              {sources.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
            <input
              value={q}
              onChange={(event) => update({ q: event.target.value })}
              placeholder="Search title…"
              className={cn(selectClass, 'w-full max-w-xs text-ink placeholder:text-ink-soft/70 sm:ml-auto')}
              aria-label="Search items"
            />
          </div>
        </CardContent>
      </Card>

      {isLoading && <Loading />}
      {error && <ErrorMsg />}
      {data && data.length === 0 && (
        <Empty text="No items for this filter. Run `python -m app.connectors reload` and `sync`, or reset the filters." />
      )}

      {data && data.length > 0 && (
        <Card>
          <CardContent className="space-y-3 p-4 pt-4 sm:p-5 sm:pt-5">
            <Table>
              <TableCaption>Market items from all sources</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Canton</TableHead>
                  <TableHead>Metrics</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead>Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.slice.map((item) => (
                  <TableRow key={`${item.source_name}-${item.id}`} className="even:bg-paper/40">
                    <TableCell className="max-w-md">
                      <a
                        href={item.url ?? item.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-ink underline-offset-2 transition-colors hover:text-brand-accent hover:underline"
                      >
                        {item.title}
                      </a>
                      {item.summary && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-soft">{item.summary}</p>}
                      {item.tags.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {item.tags.slice(0, 3).map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge variant="secondary">{item.category}</Badge>
                      <span className="ml-2 text-xs text-ink-soft">{item.categories.join(' · ')}</span>
                    </TableCell>
                    <TableCell>{item.region ?? '–'}</TableCell>
                    <TableCell><Metrics metrics={item.metrics} /></TableCell>
                    <TableCell className="tnum whitespace-nowrap text-ink-soft">{date(item.published_at)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="max-w-full truncate">{item.source_name}</Badge>
                      <p className="mt-1 text-xs text-ink-soft">updated {date(item.fetched_at)}</p>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="border-t border-line pt-3">
              <Pagination label="Items pages" page={paged.page} pageCount={paged.pageCount} total={paged.total} size={PAGE} onChange={paged.setPage} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

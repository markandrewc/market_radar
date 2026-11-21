import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePaged } from '../hooks';
import { Pagination } from '@/components/ui/pagination';
import type { MarketItem, MarketItemCategory } from '../../shared/types';
import { useItems } from '../api';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Empty, ErrorMsg, Loading } from '@/components/Status';

const categories: { value: MarketItemCategory; label: string }[] = [
  { value: 'A', label: 'A · Demand' },
  { value: 'B', label: 'B · Skills' },
  { value: 'C', label: 'C · Employers' },
  { value: 'D', label: 'D · Population' },
  { value: 'E', label: 'E · Policy' },
];

function Metrics({ metrics }: { metrics: MarketItem['metrics'] }) {
  const entries = Object.entries(metrics).filter(([, value]) => value !== null).slice(0, 3);
  if (!entries.length) return <span className="text-slate-400">–</span>;
  return (
    <span className="text-slate-600">
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
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-brand">Market items</h2>
        <p className="text-sm text-slate-500">
          Every configured source normalised into one record: category, canton, metrics, tags, date and source.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 pt-5">
          <button
            onClick={() => update({ category: '' })}
            className={`rounded-md border px-3 py-1 text-xs font-medium ${
              category ? 'border-slate-200 text-slate-600' : 'border-brand bg-brand text-white'
            }`}
          >
            All categories
          </button>
          {categories.map((entry) => (
            <button
              key={entry.value}
              onClick={() => update({ category: entry.value })}
              className={`rounded-md border px-3 py-1 text-xs font-medium ${
                category === entry.value ? 'border-brand bg-brand text-white' : 'border-slate-200 text-slate-600'
              }`}
            >
              {entry.label}
            </button>
          ))}
          <select
            value={region}
            onChange={(event) => update({ region: event.target.value })}
            className="ml-auto rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600"
            aria-label="Filter by canton"
          >
            <option value="">All cantons</option>
            {regions.map((canton) => <option key={canton} value={canton}>{canton}</option>)}
          </select>
          <select
            value={source}
            onChange={(event) => update({ source: event.target.value })}
            className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600"
            aria-label="Filter by source"
          >
            <option value="">All sources</option>
            {sources.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
          <input
            value={q}
            onChange={(event) => update({ q: event.target.value })}
            placeholder="Search title…"
            className="w-40 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700"
            aria-label="Search items"
          />
        </CardContent>
      </Card>

      {isLoading && <Loading />}
      {error && <ErrorMsg />}
      {data && data.length === 0 && (
        <Empty text="No items for this filter. Run `python -m app.connectors reload` and `sync`, or reset the filters." />
      )}

      {data && data.length > 0 && (
        <Card>
          <CardContent className="pt-5">
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
                  <TableRow key={`${item.source_name}-${item.id}`}>
                    <TableCell className="max-w-md">
                      <a href={item.url ?? item.source_url} target="_blank" rel="noreferrer" className="font-medium hover:text-brand-accent">
                        {item.title}
                      </a>
                      {item.summary && <p className="mt-1 line-clamp-2 text-xs text-slate-500">{item.summary}</p>}
                      {item.tags.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {item.tags.slice(0, 3).map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge variant="secondary">{item.category}</Badge>
                      <span className="ml-2 text-xs text-slate-500">{item.categories.join(' · ')}</span>
                    </TableCell>
                    <TableCell>{item.region ?? '–'}</TableCell>
                    <TableCell><Metrics metrics={item.metrics} /></TableCell>
                    <TableCell className="whitespace-nowrap">{date(item.published_at)}</TableCell>
                    <TableCell className="text-xs text-slate-600">
                      {item.source_name}
                      <p className="text-slate-400">updated {date(item.fetched_at)}</p>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination label="Items pages" page={paged.page} pageCount={paged.pageCount} total={paged.total} size={PAGE} onChange={paged.setPage} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

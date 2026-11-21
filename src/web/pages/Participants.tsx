import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { MarketItem } from '../../shared/types';
import { useInsights, useItems } from '../api';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Interpretation } from '@/components/Interpretation';
import { SourceBadge } from '@/components/SourceBadge';
import { Empty, ErrorMsg, Loading } from '@/components/Status';
import { formatDate, freshness, itemSource } from '../lib/source';

const MAX_METRICS = 3;

/** At most three figures per tile, formatted the Swiss way. */
function Metrics({ metrics }: { metrics: MarketItem['metrics'] }) {
  const entries = Object.entries(metrics)
    .filter(([, value]) => value !== null)
    .slice(0, MAX_METRICS);
  if (!entries.length) return <p className="text-sm text-slate-400">No figures in this record.</p>;
  return (
    <dl className="space-y-1">
      {entries.map(([name, value]) => (
        <div key={name} className="flex items-baseline justify-between gap-3">
          <dt className="text-xs uppercase tracking-wide text-slate-500">{name.replace(/_/g, ' ')}</dt>
          <dd className="text-lg font-semibold text-slate-900">{Number(value).toLocaleString('de-CH')}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function Participants() {
  const [canton, setCanton] = useState('');
  const { data, isLoading, error } = useItems({ category: 'D', limit: 100 });
  // Our plain-language reading of the target-group figures; hidden until the API has one.
  const targetInsight = useInsights({ kind: 'target' }).data?.[0];

  if (isLoading) return <Loading />;
  if (error) return <ErrorMsg />;

  const allItems = data ?? [];
  // Only real canton codes: records with region null are Switzerland-wide.
  const cantons = [...new Set(allItems.map((item) => item.region).filter((region): region is string => Boolean(region)))].sort();
  const items = canton ? allItems.filter((item) => item.region === canton) : allItems;
  const fresh = freshness(items.length ? items : allItems);

  const header = (
    <div>
      <h2 className="text-2xl font-semibold text-brand">Participants</h2>
      <p className="text-sm text-slate-500">
        Context for our participants — aggregate statistics only, no personal data.
      </p>
    </div>
  );

  if (allItems.length === 0) {
    return (
      <div className="space-y-4">
        {header}
        <Empty text="No participant statistics are stored yet. Run the connector pipeline and sync the configured sources, then reload this page." />
        <p className="text-sm text-slate-600">
          Check the <Link to="/sources" className="font-medium text-brand underline">data sources</Link> for the last sync and errors, or
          browse <Link to="/items?category=D" className="font-medium text-brand underline">all category D items</Link>.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      {targetInsight && <Interpretation insight={targetInsight} className="p-3" />}

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter participant statistics by canton">
        <button
          type="button"
          onClick={() => setCanton('')}
          aria-pressed={!canton}
          className={`rounded-md border px-3 py-1 text-xs font-medium ${
            canton ? 'border-slate-200 text-slate-600' : 'border-brand bg-brand text-white'
          }`}
        >
          All cantons
        </button>
        {cantons.map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => setCanton(canton === code ? '' : code)}
            aria-pressed={canton === code}
            className={`rounded-md border px-3 py-1 text-xs font-medium ${
              canton === code ? 'border-brand bg-brand text-white' : 'border-slate-200 text-slate-600'
            }`}
          >
            {code}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="space-y-2">
          <Empty text="No statistics for this canton right now." />
          <button
            type="button"
            onClick={() => setCanton('')}
            className="rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600"
          >
            Show all cantons
          </button>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <Card key={`${item.source_name}-${item.id}`} className="flex flex-col">
                <CardHeader className="gap-2">
                  <Badge variant="secondary" className="w-fit">
                    {item.region ?? 'Switzerland-wide'}
                  </Badge>
                  <h3 className="text-base font-semibold text-brand">{item.title}</h3>
                  <p className="text-xs text-slate-500">
                    {item.published_at ? `Published ${formatDate(item.published_at)}` : 'Publisher date not stated'}
                  </p>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col justify-between gap-3">
                  <Metrics metrics={item.metrics} />
                  <SourceBadge source={itemSource(item)} />
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            {items.length} tile(s){canton ? ` for ${canton}` : ` across ${cantons.length} canton(s)`}; each tile is one stored record.
          </p>
        </>
      )}

      {fresh && (
        <p className="text-xs text-slate-500">
          Data retrieved {formatDate(fresh.fetchedAt)} from{' '}
          <a href={fresh.url} target="_blank" rel="noreferrer" className="text-brand underline">
            {fresh.sourceName}
          </a>
          .
        </p>
      )}
    </div>
  );
}

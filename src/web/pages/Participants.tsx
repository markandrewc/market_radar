import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import type { MarketItem } from '../../shared/types';
import { useInsights, useItems } from '../api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Interpretation } from '@/components/Interpretation';
import { PageHeader } from '@/components/PageHeader';
import { FilterPills } from '@/components/FilterPills';
import { SourceBadge } from '@/components/SourceBadge';
import { TargetGroupSummary } from '@/components/TargetGroupSummary';
import { Empty, ErrorMsg, Loading } from '@/components/Status';
import { formatDate, freshness, itemSource } from '../lib/source';
import { SWISS_CANTONS } from '../lib/cantons';

const MAX_METRICS = 3;

/** Quiet inline link in supporting sentences. */
const linkClass =
  'font-medium text-brand-accent underline decoration-brand-accent/30 underline-offset-2 transition-colors hover:text-accent-deep';

/** Quiet way back to the Level 3 hub the page belongs to. */
const backLinkClass =
  'inline-flex items-center gap-1.5 text-sm text-ink-soft underline decoration-line-strong underline-offset-4 transition-colors hover:text-ink hover:decoration-ink';

/** At most three figures per tile, formatted the Swiss way. */
function Metrics({ metrics }: { metrics: MarketItem['metrics'] }) {
  const entries = Object.entries(metrics)
    .filter(([, value]) => value !== null)
    .slice(0, MAX_METRICS);
  if (!entries.length) return <p className="text-sm text-ink-soft">No figures in this record.</p>;
  return (
    <dl className="space-y-1.5 border-t border-line pt-3">
      {entries.map(([name, value]) => (
        <div key={name} className="flex items-baseline justify-between gap-3">
          <dt className="text-xs uppercase tracking-[0.12em] text-ink-soft">{name.replace(/_/g, ' ')}</dt>
          <dd className="tnum text-lg font-semibold text-ink">{Number(value).toLocaleString('de-CH')}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function Participants() {
  const [canton, setCanton] = useState('');
  // The canton filter runs in the database: the page used to slice the newest 100 records client-side.
  const { data, isLoading, error } = useItems({ category: 'D', region: canton || undefined, limit: 200 });
  // Our plain-language reading of the target-group figures; hidden until the API has one.
  const targetInsight = useInsights({ kind: 'target' }).data?.[0];

  const header = (
    <PageHeader
      kicker="LEVEL 3 · QUESTION D"
      title="Participants"
      description="Context for our participants — aggregate statistics only, no personal data."
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

  const items = data ?? [];
  // All 26 cantons are offered; a canton without stored figures shows the empty state instead of disappearing.
  const cantons = SWISS_CANTONS;
  const fresh = freshness(items);

  if (items.length === 0 && !canton) {
    return (
      <div className="space-y-8">
        {header}
        <Empty text="No participant statistics are stored yet. Run the connector pipeline and sync the configured sources, then reload this page." />
        <p className="text-sm text-ink-soft">
          Check the <Link to="/sources" className={linkClass}>data sources</Link> for the last sync and errors, or
          browse <Link to="/items?category=D" className={linkClass}>all category D items</Link>.
        </p>
      </div>
    );
  }

  const cantonOptions = [
    { value: '', label: 'All cantons' },
    ...cantons.map((code) => ({ value: code, label: code })),
  ];

  return (
    <div className="space-y-10">
      {header}

      <section aria-labelledby="participants-statistics" className="space-y-8">
        {/*
          One hidden section heading keeps the order valid without adding visible copy:
          the panels and records below carry the visible h3 headings of the design system.
        */}
        <h2 id="participants-statistics" className="sr-only">Participant statistics</h2>

        {targetInsight && (
          <Interpretation
            insight={targetInsight}
            explain={{ kind: 'insight', insightId: targetInsight.id }}
          />
        )}

        <TargetGroupSummary region={canton || undefined} />

        <FilterPills
          label="Filter participant statistics by canton"
          options={cantonOptions}
          value={canton}
          onChange={(next) => setCanton(next === canton ? '' : next)}
        />

        {items.length === 0 ? (
          <div className="space-y-4">
            <Empty text="No statistics for this canton right now." />
            <Button variant="outline" size="sm" className="rounded-control" onClick={() => setCanton('')}>
              Show all cantons
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-card border border-line bg-surface shadow-card">
              <ul className="grid divide-y divide-line sm:grid-cols-2 sm:divide-y-0">
                {items.map((item) => (
                  <li
                    key={`${item.source_name}-${item.id}`}
                    className="min-w-0 space-y-3 p-5 transition-colors hover:bg-paper/60 sm:border-line sm:[&:nth-child(even)]:border-l sm:[&:nth-child(n+3)]:border-t"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge variant="secondary">{item.region ?? 'Switzerland-wide'}</Badge>
                      <p className="tnum text-xs text-ink-soft">
                        {item.published_at ? `Published ${formatDate(item.published_at)}` : 'Publisher date not stated'}
                      </p>
                    </div>
                    <h3 className="text-base font-semibold tracking-tight text-ink">{item.title}</h3>
                    <Metrics metrics={item.metrics} />
                    <SourceBadge source={itemSource(item)} />
                  </li>
                ))}
              </ul>
            </div>
            <p className="tnum text-xs text-ink-soft">
              {items.length} tile(s){canton ? ` for ${canton}` : ` across ${cantons.length} canton(s)`}; each tile is one stored record.
            </p>
          </div>
        )}

        {fresh && (
          <p className="text-xs text-ink-soft">
            Data retrieved <span className="tnum">{formatDate(fresh.fetchedAt)}</span> from{' '}
            <a
              href={fresh.url}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-brand-accent underline decoration-brand-accent/30 underline-offset-2 transition-colors hover:text-accent-deep"
            >
              {fresh.sourceName}
            </a>
            .
          </p>
        )}
      </section>
    </div>
  );
}

import { useRef } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { ConnectorSource } from '../../shared/types';
import { useConnectors, useSources } from '../api';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/PageHeader';
import { SectionHeader } from '@/components/SectionHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { HowToAddSource } from '@/components/HowToAddSource';
import { OperatorPanel } from '@/components/OperatorPanel';
import { FeedCard } from '@/components/FeedCard';
import { AddSourceWizard } from '@/components/AddSourceWizard';
import { Empty, ErrorMsg, Loading } from '@/components/Status';
import { cn } from '@/lib/utils';

const DOCS_URL = 'https://github.com/markandrewc/market_radar/blob/main/docs/ADDING_SOURCES.md';

const STATUS_LABEL = { ok: 'Up to date', stale: 'Out of date', error: 'Problem' } as const;
const STATUS_VARIANT = { ok: 'success', stale: 'warning', error: 'default' } as const;

const dateTime = (value?: string | null) => (value ? new Date(value).toLocaleString('en-GB') : '–');

/** A source is overdue when its last sync is older than its refresh rate (or it never ran). */
function isOverdue(source: ConnectorSource): boolean {
  if (!source.enabled || source.refreshSeconds === null) return false;
  if (!source.lastSyncAt) return true;
  const last = Date.parse(source.lastSyncAt);
  return Number.isNaN(last) ? true : Date.now() - last > source.refreshSeconds * 1000;
}

function Banner({ tone, children }: { tone: 'warning' | 'error'; children: ReactNode }) {
  const className =
    tone === 'warning'
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : 'border-brand-accent/30 bg-accent-soft text-accent-deep';
  return <div className={cn('rounded-card border px-4 py-3 text-sm', className)}>{children}</div>;
}

/** One health figure: the tone dot carries no meaning on its own, the label states it. */
function HealthChip({ tone, label, count }: { tone: 'ok' | 'stale' | 'error'; label: string; count: number }) {
  const dot = tone === 'ok' ? 'bg-emerald-600' : tone === 'stale' ? 'bg-amber-500' : 'bg-brand-accent';
  return (
    <div className="flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2 shadow-card">
      <span aria-hidden className={cn('h-2 w-2 shrink-0 rounded-full', dot)} />
      <span className="text-sm text-ink-soft">{label}</span>
      <span className="tnum text-base font-semibold text-ink">{count}</span>
    </div>
  );
}

const STEPS = [
  { title: 'Paste a URL', text: 'Find the public CSV, JSON or RSS link the feed publishes and paste it into the form.' },
  { title: 'Pick category & cadence', text: 'Say what the data measures (A–E) and how often it should be fetched.' },
  { title: 'Validate & sync', text: 'The server checks the block before it saves it; only then does the feed pull its first records.' },
];

/** Three plain steps; no uptime, latency or volume promises. */
function StepsBand() {
  return (
    <section aria-labelledby="source-steps" className="surface-band px-5 py-5 sm:px-6">
      <h2 id="source-steps" className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
        Add a source in three steps
      </h2>
      <ol className="mt-4 grid gap-4 sm:grid-cols-3">
        {STEPS.map((step, index) => (
          <li key={step.title} className="space-y-1">
            <p className="kicker">
              {index + 1} · {step.title}
            </p>
            <p className="text-sm leading-relaxed text-ink-soft">{step.text}</p>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-xs leading-relaxed text-ink-soft">
        Nothing here is a promise about uptime or speed — the numbers come from each feed’s last update.
      </p>
    </section>
  );
}

const DATA_RULES = [
  'Only aggregate or public data — no personal records.',
  'No scraping where a site’s terms forbid it: official APIs, RSS feeds or open-data exports only.',
  'Raw files are hashed with sha256, so a changed file is visible.',
  'Every number in the app carries its source and the dates it was published and retrieved.',
];

function DataRules({ onOpenAdvanced }: { onOpenAdvanced: () => void }) {
  return (
    <Card>
      <CardHeader>
        <p className="kicker">GOVERNANCE</p>
        <CardTitle className="text-lg">Data rules we follow</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2.5 text-sm leading-relaxed text-ink">
          {DATA_RULES.map((rule) => (
            <li key={rule} className="flex gap-2">
              <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-accent" />
              <span>{rule}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 space-y-2 border-t border-line pt-3 text-sm">
          <a
            href={DOCS_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex font-medium text-brand-accent underline decoration-brand-accent/30 underline-offset-2 hover:text-accent-deep"
          >
            docs/ADDING_SOURCES.md
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          <p className="text-xs leading-relaxed text-ink-soft">
            The same rules apply on <Link to="/sources" className="font-medium text-brand-accent underline decoration-brand-accent/30 underline-offset-2 hover:text-accent-deep">this Data sources page</Link> and in the{' '}
            <a
              href="#advanced-sources"
              onClick={onOpenAdvanced}
              className="font-medium text-brand-accent underline decoration-brand-accent/30 underline-offset-2 hover:text-accent-deep"
            >
              advanced panel
            </a>
            .
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Sources() {
  const sources = useSources();
  const connectors = useConnectors();
  const advanced = useRef<HTMLDetailsElement>(null);

  const openAdvanced = () => {
    const element = advanced.current;
    if (!element) return;
    element.open = true;
    if (typeof element.scrollIntoView === 'function') element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const health = sources.data
    ? [
        { tone: 'ok' as const, label: STATUS_LABEL.ok, count: sources.data.filter((source) => source.status === 'ok').length },
        { tone: 'stale' as const, label: STATUS_LABEL.stale, count: sources.data.filter((source) => source.status === 'stale').length },
        { tone: 'error' as const, label: STATUS_LABEL.error, count: sources.data.filter((source) => source.status === 'error').length },
      ]
    : [];
  const total = sources.data?.length ?? 0;
  const healthy = sources.data?.filter((source) => source.status === 'ok').length ?? 0;

  return (
    <div className="space-y-10">
      <PageHeader
        kicker="LEVEL 4"
        title="Data sources & governance"
        description="Every number in Market Radar traces back to one of the feeds on this page. Adding a new one needs no engineering skills — a public URL and a few plain choices are enough."
      />

      {connectors.data?.pendingChanges && (
        <Banner tone="warning">
          <code className="font-semibold">sources.yaml</code> changed — apply it before the next sync.{' '}
          <a href="#advanced-sources" onClick={openAdvanced} className="font-medium underline underline-offset-2">
            Open Advanced: edit sources.yaml ↓
          </a>
        </Banner>
      )}

      {connectors.data?.configError && (
        <Banner tone="error">
          <span className="font-semibold">The configuration file has a problem:</span> {connectors.data.configError}
        </Banner>
      )}

      <section aria-label="Feed health" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div role="group" aria-label="Source health" className="flex flex-wrap items-center gap-2">
            {sources.isLoading ? (
              <p className="text-sm text-ink-soft">Checking feed health…</p>
            ) : sources.error || !sources.data ? (
              <p className="text-sm text-ink-soft">Feed health could not be loaded right now.</p>
            ) : (
              health.map((stat) => <HealthChip key={stat.label} tone={stat.tone} label={stat.label} count={stat.count} />)
            )}
          </div>
          <Link
            to="/items"
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-accent underline decoration-brand-accent/30 underline-offset-2 hover:text-accent-deep"
          >
            Recent records
            <span aria-hidden>→</span>
          </Link>
        </div>
        {sources.data && (
          <p className="text-sm text-ink-soft">
            {`${healthy} of ${total} feeds healthy — read from each source’s last update, nothing more.`}
          </p>
        )}
      </section>

      <StepsBand />

      <div className="grid gap-8 lg:grid-cols-12 lg:items-start">
        <div data-tour="source-feeds" className="space-y-10 lg:col-span-7">
          <section aria-labelledby="pipeline-sources" className="space-y-4">
            <SectionHeader
              id="pipeline-sources"
              kicker="PIPELINE"
              title="Pipeline sources"
              description="Official statistics pulled by the Python pipeline. Every number in the app links to one of these."
            />
            {sources.isLoading ? (
              <Loading />
            ) : sources.error || !sources.data ? (
              <ErrorMsg />
            ) : sources.data.length === 0 ? (
              <Empty text="No sources from the pipeline yet. Run `npm run pipeline` against this database." />
            ) : (
              <Card>
                <CardContent className="p-4 pt-4 sm:p-5 sm:pt-5">
                  <Table>
                    <TableCaption>Data sources and their update status</TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Source</TableHead>
                        <TableHead>Last update</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sources.data.map((source) => (
                        <TableRow key={source.id}>
                          <TableCell className="font-medium">
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noreferrer"
                              className="underline-offset-2 transition-colors hover:text-brand-accent hover:underline"
                            >
                              {source.name}
                            </a>
                            {source.datasetUrl && (
                              <p className="mt-0.5 text-xs text-ink-soft">
                                <a
                                  href={source.datasetUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="underline decoration-line-strong underline-offset-2 hover:text-ink"
                                >
                                  Dataset on opendata.swiss
                                </a>
                                {source.datasetModified ? ` · catalogue ${source.datasetModified}` : ''}
                              </p>
                            )}
                            {source.licence && <p className="text-xs text-ink-soft">{source.licence}</p>}
                          </TableCell>
                          <TableCell className="tnum whitespace-nowrap">
                            {new Date(source.lastFetchedAt).toLocaleDateString('en-GB')}
                            {source.dataAsOf && <p className="text-xs text-ink-soft">data as of {source.dataAsOf}</p>}
                          </TableCell>
                          <TableCell>
                            <Badge variant={STATUS_VARIANT[source.status]}>{STATUS_LABEL[source.status]}</Badge>
                            {source.problem && <p className="mt-1 max-w-xs text-xs text-ink-soft">{source.problem}</p>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </section>

          <section aria-labelledby="connector-feeds" className="space-y-4">
            <SectionHeader
              id="connector-feeds"
              kicker="FEEDS"
              title="Connector feeds"
              description={`Each card is one source from sources.yaml${connectors.data?.configFile ? ` — ${connectors.data.configFile}` : ''}${connectors.data?.appliedAt ? ` · applied ${dateTime(connectors.data.appliedAt)}` : ''}`}
            />
            {connectors.isLoading ? (
              <Loading />
            ) : connectors.error || !connectors.data ? (
              <ErrorMsg />
            ) : connectors.data.sources.length === 0 ? (
              <Empty text="No connector feeds yet. Use the add-source wizard to add the first one without editing code." />
            ) : (
              <ul aria-label="Configured connector feeds" className="space-y-4">
                {connectors.data.sources.map((source) => (
                  <li key={source.id}>
                    <FeedCard connector={source} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div data-tour="source-wizard" className="space-y-6 lg:col-span-5">
          <AddSourceWizard />
          <DataRules onOpenAdvanced={openAdvanced} />
        </div>
      </div>

      <HowToAddSource />

      <details ref={advanced} id="advanced-sources" className="group scroll-mt-24">
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-surface px-5 py-4 shadow-card transition-colors hover:border-line-strong [&::-webkit-details-marker]:hidden">
          <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="kicker">OPERATOR</span>
            <span className="text-base font-semibold tracking-tight text-ink">Advanced: edit sources.yaml</span>
            <span className="text-xs text-ink-soft">Raw YAML, apply the file to the database, run a sync by hand</span>
          </span>
          <span aria-hidden className="text-sm text-ink-soft transition-transform group-open:rotate-180">
            ▾
          </span>
        </summary>
        <div className="pt-6">
          <OperatorPanel />
        </div>
      </details>
    </div>
  );
}

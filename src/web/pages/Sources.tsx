import { useConnectors, useSources } from '../api';
import type { ReactNode } from 'react';
import type { ConnectorSource } from '../../shared/types';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/PageHeader';
import { SectionHeader } from '@/components/SectionHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { HowToAddSource } from '@/components/HowToAddSource';
import { OperatorPanel } from '@/components/OperatorPanel';
import { Empty, ErrorMsg, Loading } from '@/components/Status';
import { cn } from '@/lib/utils';

const variant = { ok: 'success', stale: 'warning', error: 'default' } as const;
const label = { ok: 'Up to date', stale: 'Out of date', error: 'Problem' } as const;

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

/** One health figure: a tone dot carries no meaning on its own, the label states it. */
function HealthStat({ tone, label: healthLabel, count }: { tone: 'ok' | 'stale' | 'error'; label: string; count: number }) {
  const dot = tone === 'ok' ? 'bg-emerald-600' : tone === 'stale' ? 'bg-amber-500' : 'bg-brand-accent';
  return (
    <div className="flex items-center gap-3 rounded-card border border-line bg-surface px-4 py-3 shadow-card">
      <span aria-hidden className={cn('h-2 w-2 shrink-0 rounded-full', dot)} />
      <p className="text-sm text-ink-soft">{healthLabel}</p>
      <p className="tnum ml-auto text-xl font-semibold tracking-tight text-ink">{count}</p>
    </div>
  );
}

export default function Sources() {
  const sources = useSources();
  const connectors = useConnectors();

  const health = sources.data
    ? [
        { tone: 'ok' as const, label: label.ok, count: sources.data.filter((s) => s.status === 'ok').length },
        { tone: 'stale' as const, label: label.stale, count: sources.data.filter((s) => s.status === 'stale').length },
        { tone: 'error' as const, label: label.error, count: sources.data.filter((s) => s.status === 'error').length },
      ]
    : [];

  return (
    <div className="space-y-10">
      <PageHeader
        kicker="DATA SOURCES"
        title="Data sources"
        description="Two kinds of sources feed Market Radar: the Python pipeline (official statistics) and the configurable connectors in sources.yaml. Every number in the app links back to one of them."
      />

      {connectors.data?.pendingChanges && (
        <Banner tone="warning">
          <code className="font-semibold">sources.yaml</code> changed — apply it below.{' '}
          <a href="#operator-panel" className="underline underline-offset-2">Go to the operator panel ↓</a>
        </Banner>
      )}

      {connectors.data?.configError && (
        <Banner tone="error">
          <span className="font-semibold">The configuration file has a problem:</span> {connectors.data.configError}
        </Banner>
      )}

      <section aria-labelledby="pipeline-sources" className="space-y-5">
        <SectionHeader
          id="pipeline-sources"
          kicker="PIPELINE"
          title="Pipeline sources"
          description="Every number in Market Radar links to one of these sources."
        />
        {sources.isLoading ? (
          <Loading />
        ) : sources.error || !sources.data ? (
          <ErrorMsg />
        ) : sources.data.length === 0 ? (
          <Empty text="No sources from the pipeline yet. Run `npm run pipeline` against this database." />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3" role="group" aria-label="Source health">
              {health.map((stat) => (
                <HealthStat key={stat.label} tone={stat.tone} label={stat.label} count={stat.count} />
              ))}
            </div>
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
                    {sources.data.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">
                          <a href={s.url} target="_blank" rel="noreferrer" className="underline-offset-2 transition-colors hover:text-brand-accent hover:underline">
                            {s.name}
                          </a>
                          {s.datasetUrl && (
                            <p className="mt-0.5 text-xs text-ink-soft">
                              <a href={s.datasetUrl} target="_blank" rel="noreferrer" className="underline decoration-line-strong underline-offset-2 hover:text-ink">
                                Dataset on opendata.swiss
                              </a>
                              {s.datasetModified ? ` · catalogue ${s.datasetModified}` : ''}
                            </p>
                          )}
                          {s.licence && <p className="text-xs text-ink-soft">{s.licence}</p>}
                        </TableCell>
                        <TableCell className="tnum whitespace-nowrap">
                          {new Date(s.lastFetchedAt).toLocaleDateString('en-GB')}
                          {s.dataAsOf && <p className="text-xs text-ink-soft">data as of {s.dataAsOf}</p>}
                        </TableCell>
                        <TableCell>
                          <Badge variant={variant[s.status]}>{label[s.status]}</Badge>
                          {s.problem && <p className="mt-1 max-w-xs text-xs text-ink-soft">{s.problem}</p>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </section>

      <section aria-labelledby="connector-sources" className="space-y-5">
        <SectionHeader
          id="connector-sources"
          kicker="CONNECTORS"
          title="Connector sources"
          description={`Configured in sources.yaml${connectors.data?.configFile ? ` — ${connectors.data.configFile}` : ''}${connectors.data?.appliedAt ? ` · applied ${dateTime(connectors.data.appliedAt)}` : ''}`}
        />
        {connectors.isLoading ? (
          <Loading />
        ) : connectors.error || !connectors.data ? (
          <ErrorMsg />
        ) : connectors.data.sources.length === 0 ? (
          <Empty text="No connector sources yet. Add a block to sources.yaml in the operator panel below, then sync." />
        ) : (
          <Card>
            <CardContent className="p-4 pt-4 sm:p-5 sm:pt-5">
              <Table>
                <TableCaption>Configured connectors, their refresh rate and last sync</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead>Categories</TableHead>
                    <TableHead>Adapter</TableHead>
                    <TableHead>Refresh</TableHead>
                    <TableHead>Last sync</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>State</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {connectors.data.sources.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="max-w-md font-medium">
                        <a href={s.sourceUrl} target="_blank" rel="noreferrer" className="underline-offset-2 transition-colors hover:text-brand-accent hover:underline">
                          {s.name}
                        </a>
                        {s.description && <p className="mt-0.5 text-xs text-ink-soft">{s.description}</p>}
                        {s.lastError && (
                          <p className="mt-1 max-w-xs truncate text-xs text-accent-deep" title={s.lastError}>
                            {s.lastError}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {s.categories.map((category) => (
                            <Badge key={category} variant="secondary">{category}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-ink-soft">{s.adapterType}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-ink-soft">
                        {s.refreshRate}
                        <p>{s.refreshSeconds === null ? 'manual only' : ''}</p>
                      </TableCell>
                      <TableCell className="tnum whitespace-nowrap text-xs text-ink-soft">
                        {dateTime(s.lastSyncAt)}
                      </TableCell>
                      <TableCell className="tnum">{s.itemCount.toLocaleString('de-CH')}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant={s.enabled ? 'success' : 'secondary'}>
                            {s.enabled ? 'Enabled' : 'Disabled'}
                          </Badge>
                          {isOverdue(s) && <Badge variant="warning">Overdue</Badge>}
                          {!s.inConfig && <Badge variant="outline">not in file</Badge>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </section>

      <HowToAddSource />

      {/*
        A quiet "Advanced" opener for the operator tooling. It is open by default so no
        label or message is hidden on arrival; the summary can still collapse it.
      */}
      <details open className="group">
        <summary className="list-none cursor-pointer rounded-control [&::-webkit-details-marker]:hidden">
          <SectionHeader kicker="OPERATOR" title="Advanced" />
        </summary>
        <div className="pt-6">
          <OperatorPanel />
        </div>
      </details>
    </div>
  );
}

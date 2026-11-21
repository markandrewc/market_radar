import { useConnectors, useSources } from '../api';
import type { ReactNode } from 'react';
import type { ConnectorSource } from '../../shared/types';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { HowToAddSource } from '@/components/HowToAddSource';
import { OperatorPanel } from '@/components/OperatorPanel';
import { Empty, ErrorMsg, Loading } from '@/components/Status';

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
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : 'border-red-200 bg-red-50 text-red-800';
  return <div className={`rounded-md border px-4 py-2 text-sm ${className}`}>{children}</div>;
}

export default function Sources() {
  const sources = useSources();
  const connectors = useConnectors();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data sources"
        description="Two kinds of sources feed Market Radar: the Python pipeline (official statistics) and the configurable connectors in sources.yaml. Every number in the app links back to one of them."
      />

      {connectors.data?.pendingChanges && (
        <Banner tone="warning">
          <code className="font-semibold">sources.yaml</code> changed — apply it below.{' '}
          <a href="#operator-panel" className="underline">Go to the operator panel ↓</a>
        </Banner>
      )}

      {connectors.data?.configError && (
        <Banner tone="error">
          <span className="font-semibold">The configuration file has a problem:</span> {connectors.data.configError}
        </Banner>
      )}

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-brand">Pipeline sources</h2>
          <p className="text-sm text-slate-500">Every number in Market Radar links to one of these sources.</p>
        </div>
        {sources.isLoading ? (
          <Loading />
        ) : sources.error || !sources.data ? (
          <ErrorMsg />
        ) : sources.data.length === 0 ? (
          <Empty text="No sources from the pipeline yet. Run `npm run pipeline` against this database." />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Source health">
              <Badge variant="success">Up to date: {sources.data.filter((s) => s.status === 'ok').length}</Badge>
              <Badge variant="warning">Out of date: {sources.data.filter((s) => s.status === 'stale').length}</Badge>
              <Badge variant="default">Problem: {sources.data.filter((s) => s.status === 'error').length}</Badge>
            </div>
            <Card>
              <CardContent className="pt-5">
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
                          <a href={s.url} target="_blank" rel="noreferrer">{s.name}</a>
                          {s.datasetUrl && (
                            <p className="text-xs text-slate-400">
                              <a href={s.datasetUrl} target="_blank" rel="noreferrer" className="underline">
                                Dataset on opendata.swiss
                              </a>
                              {s.datasetModified ? ` · catalogue ${s.datasetModified}` : ''}
                            </p>
                          )}
                          {s.licence && <p className="text-xs text-slate-400">{s.licence}</p>}
                        </TableCell>
                        <TableCell>
                          {new Date(s.lastFetchedAt).toLocaleDateString('en-GB')}
                          {s.dataAsOf && <p className="text-xs text-slate-400">data as of {s.dataAsOf}</p>}
                        </TableCell>
                        <TableCell>
                          <Badge variant={variant[s.status]}>{label[s.status]}</Badge>
                          {s.problem && <p className="mt-1 max-w-xs text-xs text-slate-500">{s.problem}</p>}
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

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-brand">Connector sources</h2>
          <p className="text-sm text-slate-500">
            Configured in <code className="rounded bg-slate-100 px-1">sources.yaml</code>
            {connectors.data?.configFile ? (
              <>
                {' '}— <span className="break-all text-slate-400">{connectors.data.configFile}</span>
              </>
            ) : null}
            {connectors.data?.appliedAt ? ` · applied ${dateTime(connectors.data.appliedAt)}` : ''}
          </p>
        </div>
        {connectors.isLoading ? (
          <Loading />
        ) : connectors.error || !connectors.data ? (
          <ErrorMsg />
        ) : connectors.data.sources.length === 0 ? (
          <Empty text="No connector sources yet. Add a block to sources.yaml in the operator panel below, then sync." />
        ) : (
          <Card>
            <CardContent className="pt-5">
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
                        <a href={s.sourceUrl} target="_blank" rel="noreferrer" className="hover:text-brand-accent">
                          {s.name}
                        </a>
                        {s.description && <p className="text-xs text-slate-400">{s.description}</p>}
                        {s.lastError && (
                          <p className="mt-1 max-w-xs truncate text-xs text-red-700" title={s.lastError}>
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
                      <TableCell className="whitespace-nowrap text-xs text-slate-600">{s.adapterType}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-slate-600">
                        {s.refreshRate}
                        <p className="text-slate-400">{s.refreshSeconds === null ? 'manual only' : ''}</p>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-slate-600">
                        {dateTime(s.lastSyncAt)}
                      </TableCell>
                      <TableCell>{s.itemCount.toLocaleString('de-CH')}</TableCell>
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
      <OperatorPanel />
    </div>
  );
}

import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import type { ConnectorConfigUpdate, SyncSummary } from '../../shared/types';
import { useApplyConnectorConfig, useConnectorConfig, useReloadConnectors, useSyncConnectors } from '../api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { cn } from '@/lib/utils';

/**
 * Level 4: change `sources.yaml` from the browser and pull the records in.
 * The token is only ever kept in this tab's sessionStorage — never in the bundle.
 */
const STORAGE_KEY = 'market-radar.token';
const DOCS_URL = 'https://github.com/markandrewc/market_radar/blob/main/docs/ADDING_SOURCES.md';

/** The backend answers 401 "Missing or wrong token." and 503 "Writing is disabled: set INGEST_TOKEN on the server." */
function describeError(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  if (/writing is disabled|set INGEST_TOKEN on the server/i.test(text)) {
    return 'Writing is disabled: set INGEST_TOKEN on the server.';
  }
  if (/missing or wrong token|invalid token|token rejected|unauthori[sz]ed/i.test(text)) {
    return 'Token rejected. Check that you pasted the server’s INGEST_TOKEN (no spaces).';
  }
  return text || 'Something went wrong.';
}

function readStoredToken(): string {
  try {
    return sessionStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

/** Quiet one-line code token on paper. */
const codeClass = 'rounded border border-line bg-surface px-1 py-0.5 font-mono text-[0.9em] text-ink';

type Tone = 'ok' | 'warn' | 'error';
const toneClass: Record<Tone, string> = {
  ok: 'border-line bg-brand-soft text-ink',
  warn: 'border-line bg-accent-soft text-accent-deep',
  error: 'border-brand-accent bg-accent-soft text-accent-deep',
};

function Message({ tone, title, children }: { tone: Tone; title: string; children: ReactNode }) {
  return (
    <div className={cn('rounded-card border px-3.5 py-2.5 text-xs', toneClass[tone])} role={tone === 'error' ? 'alert' : 'status'}>
      <p className="font-semibold">{title}</p>
      <div className="mt-1 space-y-1">{children}</div>
    </div>
  );
}

interface ReloadResult {
  added: number;
  updated: number;
  disabled: number;
  sourceCount: number;
  errors: string[];
}

export function OperatorPanel() {
  const queryClient = useQueryClient();
  const [token, setToken] = useState(readStoredToken);
  const [yaml, setYaml] = useState('');
  const [applyResult, setApplyResult] = useState<ConnectorConfigUpdate | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [reloadResult, setReloadResult] = useState<ReloadResult | null>(null);
  const [reloadError, setReloadError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<SyncSummary | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const config = useConnectorConfig(token);
  const apply = useApplyConnectorConfig(token);
  const reload = useReloadConnectors(token);
  const sync = useSyncConnectors(token);

  const updateToken = (next: string) => {
    setToken(next);
    setYaml('');
    setApplyResult(null);
    setApplyError(null);
    setReloadResult(null);
    setReloadError(null);
    setSyncResult(null);
    setSyncError(null);
    try {
      if (next) sessionStorage.setItem(STORAGE_KEY, next);
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // sessionStorage can be blocked (private mode); the panel still works for this page view.
    }
  };

  const refreshConnectors = () => queryClient.invalidateQueries({ queryKey: ['connectors'] });

  const loadYaml = async () => {
    setApplyError(null);
    const result = await config.refetch();
    if (result.data) setYaml(result.data.content);
    // A failed read shows up as config.error above ("Could not load the current file").
  };

  const applyYaml = async () => {
    setApplyError(null);
    setApplyResult(null);
    try {
      setApplyResult(await apply.mutateAsync(yaml));
      await refreshConnectors();
    } catch (error) {
      setApplyError(describeError(error));
    }
  };

  const reloadFile = async () => {
    setReloadError(null);
    setReloadResult(null);
    try {
      setReloadResult((await reload.mutateAsync()) as unknown as ReloadResult);
      await refreshConnectors();
    } catch (error) {
      setReloadError(describeError(error));
    }
  };

  const runSync = async (dueOnly: boolean) => {
    setSyncError(null);
    setSyncResult(null);
    try {
      setSyncResult(await sync.mutateAsync({ dueOnly }));
      await refreshConnectors();
    } catch (error) {
      setSyncError(describeError(error));
    }
  };

  const persistence = applyResult
    ? applyResult.persistent
      ? 'yes — the file is on a mounted volume, so it survives a redeploy'
      : 'no — not on a mounted volume (the change is lost on the next deploy)'
    : 'unknown until you apply — the server reports it when it saves the file';

  const syncPending = sync.isPending;

  return (
    <Card id="operator-panel">
      <CardHeader>
        <CardTitle className="text-base font-semibold tracking-tight text-ink">Source configuration (operator)</CardTitle>
        <CardDescription className="text-sm leading-relaxed text-ink-soft">
          Adding a source = paste a block into <code className={codeClass}>sources.yaml</code>, apply
          it, then sync. No terminal needed — the{' '}
          <a href={DOCS_URL} target="_blank" rel="noreferrer" className="font-medium text-brand-accent underline decoration-brand-accent/30 underline-offset-2 hover:text-accent-deep">
            one-page guide
          </a>{' '}
          has the block format.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-full max-w-md">
              <label htmlFor="ingest-token" className="text-xs font-medium text-ink-soft">Ingest token</label>
              <input
                id="ingest-token"
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={token}
                onChange={(event) => updateToken(event.target.value)}
                placeholder="Paste the server’s INGEST_TOKEN"
                className="mt-1 w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-soft/70"
              />
            </div>
            {token && (
              <button type="button" onClick={() => updateToken('')} className="text-xs font-medium text-brand-accent underline decoration-brand-accent/30 underline-offset-2 hover:text-accent-deep">
                Forget token
              </button>
            )}
          </div>
          <p className="text-xs text-ink-soft">
            The token is the server’s <code className={codeClass}>INGEST_TOKEN</code>. It is kept in
            this browser tab only (sessionStorage) and is never part of the code.
          </p>
          {!token && (
            <p className="text-sm text-ink-soft">
              Enter the token to load the current <code className={codeClass}>sources.yaml</code>,
              paste a new source and sync. Everything below needs it.
            </p>
          )}
        </div>

        {token && (
          <>
            {config.error && (
              <Message tone="error" title="Could not load the current file">
                <p>{describeError(config.error)}</p>
              </Message>
            )}

            <div className="space-y-1 rounded-card bg-brand-soft px-3.5 py-2.5 text-xs text-ink-soft">
              <p>
                File in effect:{' '}
                {config.data ? (
                  <code className={codeClass}>{config.data.file}</code>
                ) : config.isFetching ? (
                  'loading…'
                ) : (
                  'not loaded yet — use “Load current YAML”'
                )}
                {config.data?.sha256 && (
                  <span className="ml-2 text-ink-soft/60">sha256 {config.data.sha256.slice(0, 12)}…</span>
                )}
              </p>
              <p>
                Persistent: {persistence}
                {applyResult && (
                  <Badge variant={applyResult.persistent ? 'success' : 'warning'} className={cn('ml-2 rounded-full px-2.5 py-1 text-xs font-medium', applyResult.persistent ? 'border-transparent bg-surface text-ink' : 'border-transparent bg-accent-soft text-accent-deep')}>
                    {applyResult.persistent ? 'persistent' : 'not persistent'}
                  </Badge>
                )}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="sources-yaml" className="text-xs font-medium text-ink-soft">
                  <code className="font-mono">sources.yaml</code>
                </label>
                <Button type="button" variant="outline" size="sm" onClick={loadYaml} disabled={config.isFetching} className="rounded-control border-line bg-surface text-ink hover:bg-brand-soft">
                  {config.isFetching ? 'Loading…' : 'Load current YAML'}
                </Button>
                <a href={DOCS_URL} target="_blank" rel="noreferrer" className="text-xs font-medium text-brand-accent underline decoration-brand-accent/30 underline-offset-2 hover:text-accent-deep">
                  How to add a source (one page) ↗
                </a>
              </div>
              <textarea
                id="sources-yaml"
                value={yaml}
                onChange={(event) => setYaml(event.target.value)}
                spellCheck={false}
                placeholder={'# Load the current file, or paste a new block under "sources:"\nsources:\n  - id: itboard\n    name: "ITBoard Arbeitsmarkt"\n    source_url: "https://www.itboard.ch/arbeitsmarkt"\n    category: ["A"]\n    adapter_type: "csv_url"\n    endpoint: "https://www.itboard.ch/arbeitsmarkt/daten.csv"'}
                className="h-[300px] w-full resize-y rounded-control border border-line bg-paper p-3 font-mono text-xs text-ink placeholder:text-ink-soft/60"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="primary" size="sm" onClick={applyYaml} disabled={!yaml.trim() || apply.isPending} className="rounded-control">
                  {apply.isPending ? 'Validating…' : 'Validate & apply'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={reloadFile}
                  disabled={reload.isPending}
                  className="rounded-control border-line bg-surface text-ink hover:bg-brand-soft"
                  title="After editing a mounted file directly: re-read sources.yaml and apply it to the database."
                >
                  {reload.isPending ? 'Applying…' : 'Apply file to DB'}
                </Button>
                <p className="text-xs text-ink-soft">
                  <strong className="font-semibold text-ink">Validate &amp; apply</strong> writes the text above into the file and applies it in one step.{' '}
                  <strong className="font-semibold text-ink">Apply file to DB</strong> re-reads a file you edited elsewhere (e.g. on a mounted volume).
                </p>
              </div>
            </div>

            {applyError && (
              <Message tone="error" title="Could not apply the configuration">
                <p>{applyError}</p>
                <p className="text-ink-soft">
                  Nothing changed: the previous configuration stays active. Fix the block above and try again.
                </p>
              </Message>
            )}

            {applyResult && (
              <Message tone={applyResult.errors.length ? 'warn' : 'ok'} title={`Applied ${applyResult.file || 'sources.yaml'}`}>
                <p>
                  added {applyResult.added} · updated {applyResult.updated} · disabled {applyResult.disabled} · sources
                  in file {applyResult.sourceCount}
                </p>
                {applyResult.errors.length > 0 && (
                  <ul className="list-disc space-y-0.5 pl-5">
                    {applyResult.errors.map((error) => <li key={error}>{error}</li>)}
                  </ul>
                )}
                {applyResult.persistent ? (
                  <p>Saved on a mounted volume — this change survives a redeploy.</p>
                ) : (
                  <p className="font-medium">
                    This file is not on a mounted volume — the change is lost on the next deploy. Point{' '}
                    <code className={codeClass}>SOURCES_FILE</code> at a mounted volume (e.g.{' '}
                    <code className={codeClass}>/data/sources.yaml</code>) to keep it.
                  </p>
                )}
                <p className="text-ink-soft">Next: sync below so the new source’s records reach the database.</p>
              </Message>
            )}

            {reloadError && (
              <Message tone="error" title="Could not apply the file from disk">
                <p>{reloadError}</p>
              </Message>
            )}

            {reloadResult && (
              <Message tone={reloadResult.errors.length ? 'warn' : 'ok'} title="File applied from disk">
                <p>
                  added {reloadResult.added} · updated {reloadResult.updated} · disabled {reloadResult.disabled} ·
                  sources in file {reloadResult.sourceCount}
                </p>
                {reloadResult.errors.length > 0 && (
                  <ul className="list-disc space-y-0.5 pl-5">
                    {reloadResult.errors.map((error) => <li key={error}>{error}</li>)}
                  </ul>
                )}
              </Message>
            )}

            <div className="space-y-2 border-t border-line pt-4">
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="primary" size="sm" onClick={() => runSync(false)} disabled={syncPending} className="rounded-control">
                  {syncPending ? 'Syncing…' : 'Sync now'}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => runSync(true)} disabled={syncPending} className="rounded-control border-line bg-surface text-ink hover:bg-brand-soft">
                  Sync due only
                </Button>
                <p className="text-xs text-ink-soft">
                  <strong className="font-semibold text-ink">Sync now</strong> fetches every enabled source; <strong className="font-semibold text-ink">Sync due only</strong> skips sources
                  whose refresh rate has not elapsed (static sources only run on an explicit sync).
                </p>
              </div>

              {syncError && (
                <Message tone="error" title="Sync failed">
                  <p>{syncError}</p>
                  <p className="text-ink-soft">The previous records stay in place.</p>
                </Message>
              )}

              {syncResult && (
                <div className="space-y-2">
                  <p className="text-xs text-ink-soft">
                    {syncResult.results.length} source(s) · {syncResult.items.toLocaleString('de-CH')} item(s) ·{' '}
                    {syncResult.errors} error(s)
                  </p>
                  {syncResult.results.length === 0 ? (
                    <p className="text-xs text-ink-soft">No sources were synced.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Source</TableHead>
                          <TableHead>Items</TableHead>
                          <TableHead>Skipped / reason</TableHead>
                          <TableHead>Error</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {syncResult.results.map((result, index) => (
                          <TableRow key={`${result.source}-${index}`}>
                            <TableCell className="font-medium text-ink">
                              {result.source}
                              <p className="text-xs text-ink-soft/70">{result.adapter}</p>
                            </TableCell>
                            <TableCell className="tnum">{result.items.toLocaleString('de-CH')}</TableCell>
                            <TableCell className="max-w-xs text-xs text-ink-soft">
                              {result.skipped ? (result.reason || 'skipped') : '–'}
                            </TableCell>
                            <TableCell className="max-w-xs truncate text-xs text-accent-deep" title={result.error ?? undefined}>
                              {result.error ?? '–'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              )}
            </div>

            <p className="text-xs text-ink-soft">
              After a sync, connector sources and their item counts appear in the table above; the records are listed
              under <Link to="/items" className="font-medium text-brand-accent underline decoration-brand-accent/30 underline-offset-2 hover:text-accent-deep">Items</Link>.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

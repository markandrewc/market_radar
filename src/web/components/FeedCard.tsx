import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ExternalLink, RefreshCw } from 'lucide-react';
import type { ConnectorSource } from '../../shared/types';
import { useSyncConnectors } from '../api';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { cn } from '@/lib/utils';

/**
 * Level 4 feed card: one configured connector with its real state.
 * Every figure here comes from GET /api/connectors; the card never invents
 * uptime, latency or a "healthy" claim beyond the last sync timestamp.
 */

/** The ingest token lives in this tab only — never in the bundle. */
const TOKEN_KEY = 'market-radar.token';
/** Fired by the add-source wizard when the token changes, so cards stay in sync. */
export const TOKEN_CHANGED_EVENT = 'market-radar:token-changed';

export const CATEGORY_LABELS: Record<string, string> = {
  A: 'Job postings & demand',
  B: 'Skills & occupations',
  C: 'Employers',
  D: 'Population & permits',
  E: 'Policy & regulation',
};

export function readStoredToken(): string {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

const dateTime = (value?: string | null) => (value ? new Date(value).toLocaleString('en-GB') : 'never');

/** A feed is overdue when its last sync is older than its refresh rate (or it never ran). */
function isOverdue(source: ConnectorSource): boolean {
  if (!source.enabled || source.refreshSeconds === null) return false;
  if (!source.lastSyncAt) return true;
  const last = Date.parse(source.lastSyncAt);
  return Number.isNaN(last) ? true : Date.now() - last > source.refreshSeconds * 1000;
}

const toneText = {
  ok: 'text-ink',
  warn: 'text-accent-deep',
  error: 'text-brand-accent',
} as const;

interface SyncOutcome {
  tone: 'ok' | 'warn' | 'error';
  text: string;
}

export function FeedCard({ connector }: { connector: ConnectorSource }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState(readStoredToken);
  const sync = useSyncConnectors(token);
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<SyncOutcome | null>(null);
  /** Set when the click found a newer token in sessionStorage; the effect runs the sync after the token state catches up. */
  const waitingForToken = useRef(false);

  // Keep in step with the wizard / the advanced panel without a page reload.
  useEffect(() => {
    const onTokenChanged = () => setToken(readStoredToken());
    window.addEventListener(TOKEN_CHANGED_EVENT, onTokenChanged);
    return () => window.removeEventListener(TOKEN_CHANGED_EVENT, onTokenChanged);
  }, []);

  const runSync = async () => {
    setPending(true);
    setOutcome(null);
    const started = performance.now();
    try {
      const summary = await sync.mutateAsync({ dueOnly: false, source: connector.id });
      const duration = Math.max(0, Math.round(performance.now() - started));
      const row =
        summary.results.find((result) => result.source === connector.id) ??
        (summary.results.length === 1 ? summary.results[0] : undefined);
      if (!row) {
        setOutcome({
          tone: 'warn',
          text: `The server returned no result for this feed (${summary.items.toLocaleString('de-CH')} item(s) in total, ${summary.errors} error(s), ${duration} ms).`,
        });
      } else if (row.error) {
        setOutcome({ tone: 'error', text: `The feed returned an error: ${row.error} (${duration} ms). The stored records are unchanged.` });
      } else if (row.skipped) {
        setOutcome({ tone: 'warn', text: `Skipped — ${row.reason || 'no reason given by the server'} (${duration} ms).` });
      } else {
        setOutcome({ tone: 'ok', text: `Synced ${row.items.toLocaleString('de-CH')} item(s) in ${duration} ms.` });
      }
      await queryClient.invalidateQueries({ queryKey: ['connectors'] });
    } catch (error) {
      const duration = Math.max(0, Math.round(performance.now() - started));
      const message = error instanceof Error ? error.message : String(error);
      setOutcome({ tone: 'error', text: `The sync did not run: ${message} (${duration} ms). The stored records are unchanged.` });
    } finally {
      setPending(false);
    }
  };

  useEffect(() => {
    if (waitingForToken.current && token) {
      waitingForToken.current = false;
      void runSync();
    }
    // runSync is recreated with the token-aware mutation on every render; this effect only re-runs when the token changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const requestSync = () => {
    if (pending) return;
    const current = readStoredToken();
    if (!current) {
      setOutcome({ tone: 'warn', text: 'Set the ingest token in Advanced to sync.' });
      return;
    }
    if (current !== token) {
      waitingForToken.current = true;
      setToken(current);
      return;
    }
    void runSync();
  };

  const overdue = isOverdue(connector);

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant={connector.enabled ? 'success' : 'secondary'} dot>
          {connector.enabled ? 'Enabled' : 'Disabled'}
        </Badge>
        {overdue && <Badge variant="warning">Overdue</Badge>}
        {!connector.inConfig && <Badge variant="outline">not in sources.yaml</Badge>}
      </div>

      <h3 className="mt-3 text-base font-semibold tracking-tight text-ink sm:text-lg">
        <a
          href={connector.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="decoration-line-strong underline-offset-2 transition-colors hover:text-brand-accent hover:underline"
        >
          {connector.name}
          <ExternalLink className="ml-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden />
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </h3>

      {connector.description && <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{connector.description}</p>}

      <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Categories">
        {connector.categories.map((code) => (
          <li key={code}>
            <Badge variant="secondary">
              {code} · {CATEGORY_LABELS[code] ?? 'Other category'}
            </Badge>
          </li>
        ))}
      </ul>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-ink-soft">
        <div>
          <dt className="font-medium">Adapter &amp; refresh</dt>
          <dd>
            <code className="rounded border border-line bg-paper px-1 py-0.5 font-mono text-[0.95em] text-ink">{connector.adapterType}</code>
            {' · '}
            {connector.refreshRate}
            {connector.refreshSeconds === null && ' (manual only)'}
          </dd>
        </div>
        <div>
          <dt className="font-medium">Last sync</dt>
          <dd className="tnum">{dateTime(connector.lastSyncAt)}</dd>
        </div>
        <div>
          <dt className="font-medium">Items stored</dt>
          <dd className="tnum">{connector.itemCount.toLocaleString('de-CH')}</dd>
        </div>
        <div>
          <dt className="font-medium">Licence</dt>
          <dd>{connector.licence || 'not stated in the file'}</dd>
        </div>
      </dl>

      {connector.lastError && (
        <p className="mt-3 truncate text-xs font-medium text-accent-deep" title={connector.lastError}>
          Last error: {connector.lastError}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <Button type="button" variant="outline" size="sm" onClick={requestSync} disabled={pending}>
          <RefreshCw className={cn('h-4 w-4', pending && 'animate-spin')} aria-hidden />
          {pending ? 'Syncing…' : 'Sync now'}
        </Button>
        <a
          href="#add-source"
          className="text-xs font-medium text-brand-accent underline decoration-brand-accent/30 underline-offset-2 hover:text-accent-deep"
        >
          Add or change a feed
        </a>
      </div>

      {!token && !outcome && <p className="mt-2 text-xs text-ink-soft">Set the ingest token in Advanced to sync.</p>}

      {outcome && (
        <p role="status" aria-live="polite" className={cn('mt-2 text-sm', toneText[outcome.tone])}>
          {outcome.text}
        </p>
      )}

      <p className="mt-2 text-xs leading-relaxed text-ink-soft">
        {connector.enabled
          ? 'To pause this feed, set '
          : 'To turn this feed back on, set '}
        <code className="rounded border border-line bg-paper px-1 py-0.5 font-mono text-[0.95em] text-ink">
          enabled: {connector.enabled ? 'false' : 'true'}
        </code>{' '}
        for it in <code className="rounded border border-line bg-paper px-1 py-0.5 font-mono text-[0.95em] text-ink">sources.yaml</code> —{' '}
        <a href="#add-source" className="font-medium text-brand-accent underline decoration-brand-accent/30 underline-offset-2 hover:text-accent-deep">
          copy its block in the wizard
        </a>{' '}
        or open{' '}
        <a href="#advanced-sources" className="font-medium text-brand-accent underline decoration-brand-accent/30 underline-offset-2 hover:text-accent-deep">
          Advanced: edit sources.yaml
        </a>
        . Nothing is changed silently.
      </p>
    </Card>
  );
}

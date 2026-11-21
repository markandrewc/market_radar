import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Copy, FileSearch, RefreshCw, ShieldCheck } from 'lucide-react';
import type { ConnectorConfigUpdate } from '../../shared/types';
import { ApiError, useApplyConnectorConfig, useConnectorConfig, useSyncConnectors } from '../api';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { TOKEN_CHANGED_EVENT, readStoredToken } from './FeedCard';
import { cn } from '@/lib/utils';

/**
 * Level 4 add-source wizard: a labelled form that writes the same six-field block
 * a person would paste into sources.yaml. Nothing is claimed as saved until the
 * API answers; a rejected file leaves the old one exactly as it was.
 */

const TOKEN_KEY = 'market-radar.token';
const DOCS_URL = 'https://github.com/markandrewc/market_radar/blob/main/docs/ADDING_SOURCES.md';

const CATEGORY_OPTIONS = [
  { value: 'A', label: 'A · Job postings & demand' },
  { value: 'B', label: 'B · Skills & occupations' },
  { value: 'C', label: 'C · Employers' },
  { value: 'D', label: 'D · Population & permits' },
  { value: 'E', label: 'E · Policy & regulation' },
] as const;

const ADAPTER_OPTIONS = [
  { value: 'rest_api', label: 'rest_api — JSON API' },
  { value: 'csv_url', label: 'csv_url — CSV file' },
  { value: 'rss_atom', label: 'rss_atom — RSS / Atom feed' },
] as const;

const REFRESH_OPTIONS = [
  { value: 'daily', label: 'daily — every day' },
  { value: 'weekly', label: 'weekly — every week' },
  { value: 'monthly', label: 'monthly — every month' },
  { value: 'yearly', label: 'yearly — every year' },
  { value: 'static', label: 'static — only when someone syncs by hand' },
] as const;

type Category = (typeof CATEGORY_OPTIONS)[number]['value'];
type Adapter = (typeof ADAPTER_OPTIONS)[number]['value'];
type RefreshRate = (typeof REFRESH_OPTIONS)[number]['value'];

interface FormValues {
  id: string;
  name: string;
  sourceUrl: string;
  category: Category;
  adapter: Adapter;
  endpoint: string;
  refreshRate: RefreshRate;
}

const EMPTY_FORM: FormValues = {
  id: '',
  name: '',
  sourceUrl: '',
  category: 'A',
  adapter: 'rest_api',
  endpoint: '',
  refreshRate: 'weekly',
};

const SLUG = /^[a-z0-9._-]+$/;
const inputClass =
  'mt-1 w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-soft/70';
const codeClass = 'rounded border border-line bg-paper px-1 py-0.5 font-mono text-[0.95em] text-ink';

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** A YAML double-quoted scalar: escape backslashes and quotes, keep every value on one line. */
function quoteValue(value: string): string {
  const oneLine = value.replace(/[\r\n\t]+/g, ' ').trim();
  return `"${oneLine.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/** The exact block from the task: two spaces before "- id:", four before the rest. */
export function buildSourceBlock(values: FormValues): string {
  return [
    `  - id: ${values.id.trim()}`,
    `    name: ${quoteValue(values.name)}`,
    `    source_url: ${quoteValue(values.sourceUrl)}`,
    `    category: ["${values.category}"]`,
    `    adapter_type: ${quoteValue(values.adapter)}`,
    `    endpoint: ${quoteValue(values.endpoint)}`,
    `    refresh_rate: ${quoteValue(values.refreshRate)}`,
  ].join('\n');
}

/** Append the block to the end of the current file, separated by a leading newline. */
export function appendSourceBlock(content: string, block: string): string {
  const base = content.endsWith('\n') ? content : `${content}\n`;
  return `${base}\n${block}\n`;
}

function describeApplyError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 422) {
      return `${error.message}\n\nThe server rejected this file (422). The old sources.yaml is unchanged.`;
    }
    if (error.status === 401) {
      return `${error.message}\n\nThe token was rejected. Nothing was written and the old file is unchanged.`;
    }
    if (error.status === 503) {
      return `${error.message}\n\nWriting is disabled on the server. Nothing was written and the old file is unchanged.`;
    }
    return `${error.message}\n\nNothing was written; the old sources.yaml is unchanged.`;
  }
  return `${errorMessage(error)}\n\nNothing was written; the old sources.yaml is unchanged.`;
}

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

interface SyncOutcome {
  tone: 'ok' | 'warn' | 'error';
  text: string;
}
const outcomeTone = { ok: 'text-ink', warn: 'text-accent-deep', error: 'text-brand-accent' } as const;

export function AddSourceWizard() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormValues>(EMPTY_FORM);
  const [token, setToken] = useState(readStoredToken);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [applyResult, setApplyResult] = useState<ConnectorConfigUpdate | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [appliedId, setAppliedId] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [syncing, setSyncing] = useState(false);
  const [syncOutcome, setSyncOutcome] = useState<SyncOutcome | null>(null);
  /** A click can find a newer token in sessionStorage; the effect applies/syncs once the hook has it. */
  const waitingToApply = useRef(false);
  const waitingToSync = useRef(false);

  const config = useConnectorConfig(token);
  const apply = useApplyConnectorConfig(token);
  const sync = useSyncConnectors(token);

  const block = buildSourceBlock(form);
  const idIsSlug = SLUG.test(form.id.trim());
  const persistence = applyResult
    ? applyResult.persistent
      ? 'yes — the file is on a mounted volume, so it survives a redeploy.'
      : 'no — not on a mounted volume; the change is lost on the next deploy. Point SOURCES_FILE at a mounted volume to keep it.'
    : 'reported by the server after the file is saved.';

  const updateToken = (next: string) => {
    setToken(next);
    setApplyResult(null);
    setApplyError(null);
    setAppliedId(null);
    setSyncOutcome(null);
    setCheckError(null);
    try {
      if (next) sessionStorage.setItem(TOKEN_KEY, next);
      else sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      // sessionStorage can be blocked (private mode); the form still works for this page view.
    }
    window.dispatchEvent(new CustomEvent(TOKEN_CHANGED_EVENT));
  };

  const update = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    setApplyResult(null);
    setApplyError(null);
    setAppliedId(null);
    setSyncOutcome(null);
  };

  const checkFile = async () => {
    setCheckError(null);
    const current = readStoredToken();
    if (!current) {
      setCheckError('Set the ingest token first — reading the current file needs it.');
      return;
    }
    if (current !== token) {
      // The config query is enabled by the token state; it loads the file as soon as that updates.
      setToken(current);
      return;
    }
    const result = await config.refetch();
    if (result.error) setCheckError(`Could not read the current file: ${errorMessage(result.error)}`);
  };

  const appendAndApply = async () => {
    setApplyError(null);
    setApplyResult(null);
    setAppliedId(null);
    setSyncOutcome(null);
    setCheckError(null);

    const current = readStoredToken();
    if (!current) {
      setApplyError('Set the ingest token before applying — nothing was sent.');
      return;
    }
    if (current !== token) {
      waitingToApply.current = true;
      setToken(current);
      return;
    }
    if (!form.id.trim() || !form.name.trim() || !form.sourceUrl.trim() || !form.endpoint.trim()) {
      setApplyError('Fill in the source id, name, original page URL and endpoint first — nothing was sent.');
      return;
    }
    if (!idIsSlug) {
      setApplyError('The source id must be a lowercase slug (a–z, 0–9, dot, dash or underscore) — nothing was sent.');
      return;
    }

    // Read the file that is in effect right now, so the append is based on the real current content.
    const read = await config.refetch();
    if (read.error) {
      setApplyError(`Could not read the current sources.yaml: ${errorMessage(read.error)}. Nothing was changed.`);
      return;
    }
    const content = read.data?.content ?? null;
    if (content === null) {
      setApplyError('Could not read the current sources.yaml, so nothing was changed. Check the token and use “Check current file” first.');
      return;
    }

    const idForSync = form.id.trim();
    try {
      const result = await apply.mutateAsync(appendSourceBlock(content, block));
      setApplyResult(result);
      setAppliedId(idForSync);
      await queryClient.invalidateQueries({ queryKey: ['connectors'] });
    } catch (error) {
      setApplyError(describeApplyError(error));
    }
  };

  const runSyncNew = async () => {
    const id = appliedId;
    if (!id) return;
    setSyncing(true);
    setSyncOutcome(null);
    const started = performance.now();
    try {
      const summary = await sync.mutateAsync({ dueOnly: false, source: id });
      const duration = Math.max(0, Math.round(performance.now() - started));
      const row =
        summary.results.find((result) => result.source === id) ??
        (summary.results.length === 1 ? summary.results[0] : undefined);
      if (!row) {
        setSyncOutcome({
          tone: 'warn',
          text: `The server returned no result for this source (${summary.items.toLocaleString('de-CH')} item(s) in total, ${summary.errors} error(s), ${duration} ms).`,
        });
      } else if (row.error) {
        setSyncOutcome({ tone: 'error', text: `The feed returned an error: ${row.error} (${duration} ms). The stored records are unchanged.` });
      } else if (row.skipped) {
        setSyncOutcome({ tone: 'warn', text: `Skipped — ${row.reason || 'no reason given by the server'} (${duration} ms).` });
      } else {
        setSyncOutcome({ tone: 'ok', text: `Synced ${row.items.toLocaleString('de-CH')} item(s) in ${duration} ms.` });
      }
      await queryClient.invalidateQueries({ queryKey: ['connectors'] });
    } catch (error) {
      const duration = Math.max(0, Math.round(performance.now() - started));
      setSyncOutcome({
        tone: 'error',
        text: `The sync did not run: ${errorMessage(error)} (${duration} ms). The stored records are unchanged.`,
      });
    } finally {
      setSyncing(false);
    }
  };

  const requestSyncNew = () => {
    if (syncing) return;
    const current = readStoredToken();
    if (!current) {
      setSyncOutcome({ tone: 'warn', text: 'Set the ingest token in Advanced to sync.' });
      return;
    }
    if (current !== token) {
      waitingToSync.current = true;
      setToken(current);
      return;
    }
    void runSyncNew();
  };

  const copyBlock = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(block);
        setCopyState('copied');
        return;
      }
    } catch {
      // Fall through to the manual copy below.
    }
    try {
      const area = document.createElement('textarea');
      area.value = block;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.top = '0';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const copied = typeof document.execCommand === 'function' ? document.execCommand('copy') : false;
      document.body.removeChild(area);
      setCopyState(copied ? 'copied' : 'failed');
    } catch {
      setCopyState('failed');
    }
  };

  // Finish an apply or a sync that was waiting for a token found in sessionStorage.
  useEffect(() => {
    if (!token) return;
    if (waitingToApply.current) {
      waitingToApply.current = false;
      void appendAndApply();
    }
    if (waitingToSync.current) {
      waitingToSync.current = false;
      void runSyncNew();
    }
    // Recreated on every render with the token-aware mutations; only run when the token changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const endpointHint =
    form.adapter === 'rss_atom'
      ? 'The RSS or Atom feed URL. For several feeds of one source, add them as `endpoints` in Advanced.'
      : form.adapter === 'csv_url'
        ? 'A direct link to the CSV file (or a file:// path inside the container).'
        : 'The JSON endpoint the API publishes (GET).';

  return (
    <Card id="add-source" className="scroll-mt-24">
      <CardHeader>
        <p className="kicker">ADD A SOURCE</p>
        <CardTitle className="text-xl sm:text-2xl">Add a source without touching code</CardTitle>
        <CardDescription className="text-[15px] leading-relaxed">
          Paste the public feed URL, say what it measures, check the block and apply it. The server validates the
          file before anything is saved, so a bad block cannot break the feeds that already work.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="space-y-1.5">
          <label htmlFor="add-source-token" className="block text-sm font-medium text-ink">
            Ingest token
          </label>
          <input
            id="add-source-token"
            name="ingest-token"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={token}
            onChange={(event) => updateToken(event.target.value)}
            placeholder="Paste the server’s INGEST_TOKEN"
            className={inputClass}
          />
          <p className="text-xs text-ink-soft">
            Kept in this browser tab only (sessionStorage), never in the code. Reading or writing the file needs it.
          </p>
        </div>

        <div className="space-y-2 rounded-card border border-line bg-brand-soft px-3.5 py-2.5 text-xs text-ink-soft">
          <p>
            Current file:{' '}
            {config.data ? (
              <>
                <code className={codeClass}>{config.data.file}</code>{' '}
                <span className="text-ink-soft/80">sha256 {config.data.sha256.slice(0, 12)}…</span>
              </>
            ) : config.isFetching ? (
              'reading…'
            ) : token ? (
              'not read yet — use “Check current file”.'
            ) : (
              'enter the token to read it.'
            )}
          </p>
          <p>Persistence: {persistence}</p>
          {checkError && (
            <p role="alert" className="font-medium text-accent-deep">
              {checkError}
            </p>
          )}
          {token && config.error && (
            <p role="alert" className="font-medium text-accent-deep">
              Could not load the current file: {errorMessage(config.error)}
            </p>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void checkFile()}
            disabled={!token || config.isFetching}
            className="mt-1"
          >
            <FileSearch className="h-4 w-4" aria-hidden />
            {config.isFetching ? 'Reading…' : 'Check current file'}
          </Button>
        </div>

        <form
          aria-label="Add a data source"
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void appendAndApply();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="add-source-id" className="block text-sm font-medium text-ink">
                Source id <span className="font-normal text-ink-soft">(slug)</span>
              </label>
              <input
                id="add-source-id"
                name="id"
                required
                pattern="[a-z0-9._-]+"
                autoComplete="off"
                spellCheck={false}
                value={form.id}
                onChange={(event) => update('id', event.target.value)}
                placeholder="itboard-arbeitsmarkt"
                aria-describedby="add-source-id-hint"
                className={inputClass}
              />
              <p id="add-source-id-hint" className="mt-1 text-xs text-ink-soft">
                Lowercase letters, digits, dots, dashes and underscores. It is the key for filters and sync.
              </p>
              {form.id && !idIsSlug && (
                <p className="mt-1 text-xs font-medium text-accent-deep">
                  Not a valid slug yet — use lowercase letters, digits, dots, dashes or underscores.
                </p>
              )}
            </div>

            <div>
              <label htmlFor="add-source-name" className="block text-sm font-medium text-ink">
                Name shown in the app
              </label>
              <input
                id="add-source-name"
                name="name"
                required
                value={form.name}
                onChange={(event) => update('name', event.target.value)}
                placeholder="ITBoard Arbeitsmarkt"
                className={inputClass}
              />
              <p className="mt-1 text-xs text-ink-soft">Appears next to every number this feed produces.</p>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="add-source-url" className="block text-sm font-medium text-ink">
                Original page URL
              </label>
              <input
                id="add-source-url"
                name="source_url"
                type="url"
                required
                autoComplete="off"
                spellCheck={false}
                value={form.sourceUrl}
                onChange={(event) => update('sourceUrl', event.target.value)}
                placeholder="https://www.itboard.ch/arbeitsmarkt"
                className={inputClass}
              />
              <p className="mt-1 text-xs text-ink-soft">The page a person can open to check the original data.</p>
            </div>

            <div>
              <label htmlFor="add-source-category" className="block text-sm font-medium text-ink">
                Category
              </label>
              <select
                id="add-source-category"
                name="category"
                value={form.category}
                onChange={(event) => update('category', event.target.value as Category)}
                className={inputClass}
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="add-source-adapter" className="block text-sm font-medium text-ink">
                Adapter
              </label>
              <select
                id="add-source-adapter"
                name="adapter_type"
                value={form.adapter}
                onChange={(event) => update('adapter', event.target.value as Adapter)}
                className={inputClass}
              >
                {ADAPTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="add-source-endpoint" className="block text-sm font-medium text-ink">
                Endpoint
              </label>
              <input
                id="add-source-endpoint"
                name="endpoint"
                type="url"
                required
                autoComplete="off"
                spellCheck={false}
                value={form.endpoint}
                onChange={(event) => update('endpoint', event.target.value)}
                placeholder="https://www.itboard.ch/arbeitsmarkt/daten.csv"
                aria-describedby="add-source-endpoint-hint"
                className={inputClass}
              />
              <p id="add-source-endpoint-hint" className="mt-1 text-xs text-ink-soft">
                {endpointHint}
              </p>
            </div>

            <div>
              <label htmlFor="add-source-refresh" className="block text-sm font-medium text-ink">
                Refresh rate
              </label>
              <select
                id="add-source-refresh"
                name="refresh_rate"
                value={form.refreshRate}
                onChange={(event) => update('refreshRate', event.target.value as RefreshRate)}
                className={inputClass}
              >
                {REFRESH_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold tracking-tight text-ink">Preview — this exact block is added to sources.yaml</h3>
              <Button type="button" variant="outline" size="sm" onClick={() => void copyBlock()}>
                <Copy className="h-4 w-4" aria-hidden />
                Copy block
              </Button>
            </div>
            <p className="mt-1 text-xs text-ink-soft">
              Two spaces before <code className={codeClass}>- id:</code>, four before the other fields, values quoted
              safely. The block is appended to the end of the current file, under the existing list.
            </p>
            <pre className="mt-2 overflow-x-auto rounded-control border border-line bg-paper p-3 font-mono text-xs leading-relaxed text-ink">
              {block}
            </pre>
            <p className="mt-1 text-xs text-ink-soft" aria-live="polite">
              {copyState === 'copied'
                ? 'Copied — paste it into sources.yaml if you edit the file yourself.'
                : copyState === 'failed'
                  ? 'The copy did not work — select the block above and copy it yourself.'
                  : 'Copy this block if you prefer to edit sources.yaml by hand.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" size="sm" disabled={!token || apply.isPending}>
              {apply.isPending ? 'Validating…' : 'Validate & apply'}
            </Button>
            <p className="text-xs text-ink-soft">
              Appends the block to the saved file and saves it in one step. If the server rejects it, the old file stays
              exactly as it was.
            </p>
          </div>
        </form>

        {applyResult && (
          <Message tone={applyResult.errors.length ? 'warn' : 'ok'} title={`Saved ${applyResult.file || 'sources.yaml'}`}>
            <p>
              added {applyResult.added} · updated {applyResult.updated} · disabled {applyResult.disabled} · sources in
              file {applyResult.sourceCount}
            </p>
            {applyResult.errors.length > 0 && (
              <ul className="list-disc space-y-0.5 pl-5">
                {applyResult.errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            )}
            <p>
              Persistent: {applyResult.persistent ? 'yes — saved on a mounted volume, so it survives a redeploy.' : 'no — not on a mounted volume; the change is lost on the next deploy.'}
            </p>
            <p>Next: sync the new source so its records reach the database.</p>
          </Message>
        )}

        {applyError && (
          <Message tone="error" title="The file was not saved">
            <p className="whitespace-pre-line">{applyError}</p>
          </Message>
        )}

        {appliedId && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" onClick={requestSyncNew} disabled={syncing}>
                <RefreshCw className={cn('h-4 w-4', syncing && 'animate-spin')} aria-hidden />
                {syncing ? 'Syncing…' : 'Sync new source'}
              </Button>
              <Badge variant="secondary">
                <Check className="h-3 w-3" aria-hidden />
                {appliedId}
              </Badge>
              <p className="text-xs text-ink-soft">Fetch the first records from the source you just added.</p>
            </div>
            {syncOutcome && (
              <p role="status" aria-live="polite" className={cn('text-sm', outcomeTone[syncOutcome.tone])}>
                {syncOutcome.text}
              </p>
            )}
          </div>
        )}

        <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-soft">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent" aria-hidden />
          <span>
            The block only stores where an official feed lives; the data rules beside this form apply to every feed.
            Read the{' '}
            <a href={DOCS_URL} target="_blank" rel="noreferrer" className="font-medium text-brand-accent underline decoration-brand-accent/30 underline-offset-2 hover:text-accent-deep">
              one-page guide
            </a>{' '}
            for every optional field.
          </span>
        </p>
      </CardContent>
    </Card>
  );
}

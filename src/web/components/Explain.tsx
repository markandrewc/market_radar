import { useEffect, useId, useRef, useState } from 'react';
import { ExternalLink, Sparkles } from 'lucide-react';
import type { CitedSentence, ExplainRequest, Explanation, SourceRef } from '../../shared/types';
import { ApiError, useExplain, useLlmStatus } from '../api';
import { formatDate } from './SourceInfo';
import { Button } from './ui/button';

/** One source under one sentence: publisher, both dates and the original page. */
function SourceLink({ source }: { source: SourceRef }) {
  const asOf = source.dataAsOf ? formatDate(source.dataAsOf) : null;
  const retrieved = formatDate(source.fetchedAt);
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex max-w-full items-center gap-1 text-brand-accent underline underline-offset-2 hover:text-brand"
    >
      <span>
        {source.name}
        {asOf ? ` · data as of ${asOf}` : ''} · retrieved {retrieved}
      </span>
      <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

/**
 * The model answer is already split into sentences on the server, so each sentence
 * keeps the exact source it was checked against: no number or claim without its link.
 */
function SentenceList({ sentences }: { sentences: CitedSentence[] }) {
  return (
    <ul className="space-y-2">
      {sentences.map((sentence, index) => (
        <li key={`${index}-${sentence.text.slice(0, 24)}`} className="space-y-1">
          <p className="text-sm text-slate-800">{sentence.text}</p>
          {sentence.sources.length > 0 ? (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600">
              <span className="font-medium text-slate-700">Source:</span>
              {sentence.sources.map((source, sourceIndex) => (
                <SourceLink key={`${source.id}-${sourceIndex}`} source={source} />
              ))}
            </p>
          ) : (
            <p className="text-xs text-slate-500">No source is stated for this sentence.</p>
          )}
        </li>
      ))}
    </ul>
  );
}

/** A calm, specific message instead of a raw HTTP error. */
function friendlyError(error: unknown): string {
  const status = error instanceof ApiError ? error.status : null;
  if (status === 429) return 'Too many explanations were requested just now. Please try again in a moment.';
  if (status === 503) return 'The AI service is temporarily unavailable. Please try again in a moment.';
  if (status === null) return 'The explanation service could not be reached. Check your connection and try again.';
  return 'The plain-language explanation could not be written just now. Please try again.';
}

function ExplanationBody({
  explanation,
  fallbackText,
  fallbackId,
}: {
  explanation: Explanation;
  fallbackText?: string;
  fallbackId: string;
}) {
  const [showFallback, setShowFallback] = useState(false);
  const fromModel = explanation.method === 'model';
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
        {fromModel ? 'AI explanation · our reading, not the source' : 'AI unavailable — showing the data-based reading'}
      </p>

      {explanation.sentences.length > 0 ? (
        <SentenceList sentences={explanation.sentences} />
      ) : (
        <p className="text-sm text-slate-800">{explanation.text}</p>
      )}

      {fromModel && (
        <p className="text-xs text-slate-500">
          {explanation.model ? `Model ${explanation.model}` : 'Model not stated'}
          {explanation.cached ? ' · cached' : ''}
        </p>
      )}

      <p className="text-xs text-slate-600">{explanation.disclaimer}</p>

      {fromModel && fallbackText && (
        <div className="space-y-1 border-t border-slate-100 pt-2">
          <button
            type="button"
            aria-expanded={showFallback}
            aria-controls={fallbackId}
            onClick={() => setShowFallback((shown) => !shown)}
            className="text-xs font-medium text-brand-accent underline underline-offset-2 hover:text-brand"
          >
            Show the data-based reading
          </button>
          <div id={fallbackId} hidden={!showFallback} className="rounded-md bg-slate-100 p-2 text-xs text-slate-600">
            {fallbackText}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * "Explain simply": a plain-language reading of one insight or one policy item,
 * written by the model only after the server checked every number and citation.
 * The deterministic data-based reading always stays available, and the card around
 * this panel is never touched — a failed explanation only shows a short message.
 */
export function ExplainPanel({ target, fallbackText }: { target: ExplainRequest; fallbackText?: string }) {
  const status = useLlmStatus();
  const explanation = useExplain();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const fallbackId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  // Move focus into the new text, so keyboard and screen-reader users land on it.
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  if (status.isPending || !status.data) return null;
  if (!status.data.enabled) {
    return <p className="text-xs text-slate-500">AI explanations are not configured on this server.</p>;
  }

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    // Ask once. Re-opening after a failure tries again; the button label never lies.
    if (explanation.data === undefined && !explanation.isPending) explanation.mutate(target);
  };

  return (
    <div className="w-full space-y-2">
      <Button
        variant="outline"
        size="sm"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
        className="w-fit"
      >
        <Sparkles className="h-4 w-4" aria-hidden />
        Explain simply
      </Button>

      <div
        id={panelId}
        ref={panelRef}
        tabIndex={-1}
        hidden={!open}
        aria-busy={open ? explanation.isPending : undefined}
        className="rounded-lg border border-slate-200 bg-white p-3 text-slate-800 shadow-sm focus:outline-2 focus:outline-offset-2 focus:outline-brand-accent"
      >
        {open && explanation.isPending && (
          <p aria-live="polite" className="text-sm text-slate-700">
            Writing a plain-language explanation…
          </p>
        )}

        {open && explanation.isError && (
          <div className="space-y-2">
            <p className="text-sm text-slate-800">{friendlyError(explanation.error)}</p>
            <Button variant="outline" size="sm" onClick={() => explanation.mutate(target)}>
              Try again
            </Button>
          </div>
        )}

        {open && explanation.data && !explanation.isPending && (
          <ExplanationBody explanation={explanation.data} fallbackText={fallbackText} fallbackId={fallbackId} />
        )}
      </div>
    </div>
  );
}

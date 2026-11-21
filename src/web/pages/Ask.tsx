import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, RefreshCw, SearchX, Sparkles } from 'lucide-react';
import type { AskAnswer, SourceRef } from '../../shared/types';
import { ApiError, useAsk, useLlmStatus } from '../api';
import { PageHeader } from '@/components/PageHeader';
import { SourceInfo, formatDate } from '@/components/SourceInfo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const HISTORY_KEY = 'mr-ask-history';
const MAX_QUESTION_LENGTH = 300;
const MAX_HISTORY = 3;

/** Questions the team can start from; each one is answered from the stored data. */
const SUGGESTIONS = [
  'Which skills should we teach for IT Support?',
  'Which roles are growing fastest?',
  'What is new in policy this week?',
  'Who is hiring for Data Analyst?',
];

/** The label that tells people how an answer was produced, always in words, never by colour alone. */
const METHOD: Record<AskAnswer['method'], { label: string; variant: 'outline' | 'warning' | 'secondary' }> = {
  model: { label: 'AI explanation', variant: 'outline' },
  fallback: { label: 'AI unavailable — data-based answer', variant: 'warning' },
  no_data: { label: 'No data on that', variant: 'secondary' },
};

/** Remember the last questions in this tab only. Storage may be blocked; then history stays in memory. */
function readHistory(): string[] {
  try {
    const raw = sessionStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((item) => item.trim().slice(0, MAX_QUESTION_LENGTH))
      .slice(0, MAX_HISTORY);
  } catch {
    return [];
  }
}

function saveHistory(questions: string[]): void {
  try {
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(questions));
  } catch {
    /* storage blocked: the chips still work for this visit */
  }
}

/** One source named in a sentence or in the "I used these sources" list. */
function SourceLink({ source }: { source: SourceRef }) {
  const asOf = source.dataAsOf ? formatDate(source.dataAsOf) : null;
  const retrieved = formatDate(source.fetchedAt);
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 break-words text-xs font-medium text-brand-accent underline underline-offset-2 hover:text-brand"
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

function FollowUps({ followUps, pending, onAsk }: { followUps: string[]; pending: boolean; onAsk: (question: string) => void }) {
  if (followUps.length === 0) return null;
  return (
    <div className="space-y-2 border-t border-slate-100 pt-3">
      <p className="text-sm font-medium text-slate-700">You could also ask</p>
      <div className="flex flex-wrap gap-2">
        {followUps.map((followUp) => (
          <Button key={followUp} variant="outline" size="sm" disabled={pending} onClick={() => onAsk(followUp)}>
            {followUp}
          </Button>
        ))}
      </div>
    </div>
  );
}

/** The answer itself: what was asked, how it was produced, every sentence with its own sources. */
function AnswerPanel({
  answer,
  pending,
  headingRef,
  onAsk,
}: {
  answer: AskAnswer;
  pending: boolean;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onAsk: (question: string) => void;
}) {
  const method = METHOD[answer.method];
  // A source may support several sentences; the list at the end names each one once.
  const usedSources = Array.from(new Map(answer.usedSources.map((source) => [source.id || source.url, source])).values());

  return (
    <section aria-labelledby="ask-answer-heading" className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="ask-answer-heading" ref={headingRef} tabIndex={-1} className="text-xl font-semibold text-brand">
          The answer
        </h2>
        <Badge variant={method.variant}>{method.label}</Badge>
      </div>
      <p className="text-sm text-slate-600">Your question: “{answer.question}”</p>

      {answer.method === 'no_data' ? (
        <div className="space-y-4">
          <p className="text-slate-800">{answer.text}</p>
          <FollowUps followUps={answer.followUps} pending={pending} onAsk={onAsk} />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-3">
            {answer.sentences.length > 0 ? (
              answer.sentences.map((sentence, index) => (
                <div key={`${sentence.text}-${index}`} className="space-y-1">
                  <p className="text-slate-800">{sentence.text}</p>
                  {sentence.sources.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {sentence.sources.map((source, sourceIndex) => (
                        <SourceInfo key={`${source.id || source.url}-${sourceIndex}`} source={source} />
                      ))}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-slate-800">{answer.text}</p>
            )}
          </div>

          {usedSources.length > 0 && (
            <section aria-labelledby="ask-sources-heading" className="space-y-1 border-t border-slate-100 pt-3">
              <h3 id="ask-sources-heading" className="text-sm font-semibold text-brand">
                I used these sources
              </h3>
              <ul className="space-y-1">
                {usedSources.map((source) => (
                  <li key={source.id || source.url}>
                    <SourceLink source={source} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {answer.disclaimer ? <p className="border-t border-slate-100 pt-3 text-xs text-slate-500">{answer.disclaimer}</p> : null}

          <FollowUps followUps={answer.followUps} pending={pending} onAsk={onAsk} />
        </div>
      )}
    </section>
  );
}

/** The calm state for a server without a configured AI provider: no form, just the way back to the readings. */
function NotConfiguredNotice() {
  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-5">
      <p className="text-slate-800">
        Ask is not configured on this server. You can still read the data-based readings on the pages.
      </p>
      <p className="text-sm text-slate-600">
        Try the <Link to="/" className="font-medium text-brand-accent underline underline-offset-2">Job market</Link> or{' '}
        <Link to="/policy" className="font-medium text-brand-accent underline underline-offset-2">Policy news</Link> pages instead.
      </p>
    </div>
  );
}

/** Skeleton shown while we check whether Ask is available on this server. */
function AskSkeleton() {
  return (
    <div role="status" aria-live="polite" className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <span className="sr-only">Checking whether Ask is available…</span>
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-9 w-24" />
    </div>
  );
}

/** 503 and 429 have their own plain-language wording; everything else is the generic apology. */
function errorMessage(error: Error): string {
  if (error instanceof ApiError) {
    if (error.status === 503) return 'Ask is not configured on this server.';
    if (error.status === 429) return 'Too many questions right now — please try again in a minute.';
  }
  return 'Something went wrong. Please try again.';
}

export default function Ask() {
  const llm = useLlmStatus();
  const ask = useAsk();
  const [question, setQuestion] = useState('');
  const [lastAsked, setLastAsked] = useState('');
  const [history, setHistory] = useState<string[]>(readHistory);
  const answerHeading = useRef<HTMLHeadingElement>(null);
  const focusedAnswer = useRef<AskAnswer | null>(null);
  const inputId = useId();
  const hintId = `${inputId}-hint`;

  const answer = ask.status === 'success' ? ask.data : undefined;
  const pending = ask.isPending;

  // Keep the last questions in this tab; a blocked sessionStorage just leaves the chips in memory.
  useEffect(() => {
    if (history.length > 0) {
      saveHistory(history);
      return;
    }
    try {
      sessionStorage.removeItem(HISTORY_KEY);
    } catch {
      /* storage blocked: nothing to clean up */
    }
  }, [history]);

  // After a successful answer, move focus to the answer heading so keyboard and screen-reader
  // users land on the result without hunting for it.
  useEffect(() => {
    if (!answer || focusedAnswer.current === answer) return;
    focusedAnswer.current = answer;
    answerHeading.current?.focus();
  }, [answer]);

  const askQuestion = (raw: string) => {
    const text = raw.trim().slice(0, MAX_QUESTION_LENGTH);
    if (!text) return;
    setQuestion(text);
    setLastAsked(text);
    setHistory((previous) => [text, ...previous.filter((item) => item !== text)].slice(0, MAX_HISTORY));
    ask.mutate({ question: text, language: 'en' });
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    askQuestion(question);
  };

  const retry = () => {
    if (lastAsked) askQuestion(lastAsked);
  };

  const clearHistory = () => {
    setHistory([]);
    try {
      sessionStorage.removeItem(HISTORY_KEY);
    } catch {
      /* storage blocked: clearing the state is enough */
    }
  };

  const header = (
    <PageHeader
      title="Ask the radar"
      description="Ask about the roles we track, the skills in the postings, employers, the target group or policy news. Answers use only the data we store and name their sources."
    />
  );

  if (llm.isLoading) {
    return (
      <div className="space-y-6">
        {header}
        <AskSkeleton />
      </div>
    );
  }

  if (llm.data?.enabled === false) {
    return (
      <div className="space-y-6">
        {header}
        <NotConfiguredNotice />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      <Card>
        <CardContent className="space-y-4 pt-5">
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1">
              <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
                Your question
              </label>
              <input
                id={inputId}
                name="question"
                type="text"
                required
                maxLength={MAX_QUESTION_LENGTH}
                value={question}
                onChange={(event) => setQuestion(event.target.value.slice(0, MAX_QUESTION_LENGTH))}
                aria-describedby={hintId}
                placeholder="For example: Which skills should we teach for IT Support?"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-brand-accent"
              />
              <p id={hintId} className="text-xs text-slate-500">
                Up to {MAX_QUESTION_LENGTH} characters. Answers use only the data we store and name their sources.
              </p>
            </div>
            <Button type="submit" disabled={pending || question.trim().length === 0}>
              Ask
            </Button>
          </form>

          <div className="space-y-2 border-t border-slate-100 pt-3">
            <p id="ask-suggestions-heading" className="text-sm font-medium text-slate-700">
              Try one of these
            </p>
            <div role="group" aria-labelledby="ask-suggestions-heading" className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <Button key={suggestion} variant="outline" size="sm" disabled={pending} onClick={() => askQuestion(suggestion)}>
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {history.length > 0 && (
        <section aria-labelledby="ask-history-heading" className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="ask-history-heading" className="font-semibold text-brand">
              Your last questions
            </h2>
            <Button variant="ghost" size="sm" onClick={clearHistory}>
              Clear
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {history.map((item) => (
              <Button key={item} variant="outline" size="sm" disabled={pending} onClick={() => askQuestion(item)}>
                {item}
              </Button>
            ))}
          </div>
          <p className="text-xs text-slate-500">Kept in this browser tab only.</p>
        </section>
      )}

      <div aria-live="polite" aria-atomic="false" className="space-y-4">
        {pending && (
          <p role="status" className="flex items-center gap-2 text-sm text-slate-600">
            <Sparkles className="h-4 w-4 shrink-0 text-brand-accent motion-safe:animate-pulse" aria-hidden />
            Asking the radar…
          </p>
        )}
        {answer && <AnswerPanel answer={answer} pending={pending} headingRef={answerHeading} onAsk={askQuestion} />}
      </div>

      {ask.error && (
        <div role="alert" className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <p className="flex items-start gap-2">
            <SearchX className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {errorMessage(ask.error)}
          </p>
          {lastAsked && (
            <Button variant="outline" size="sm" onClick={retry}>
              <RefreshCw className="h-4 w-4" aria-hidden />
              Try again
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

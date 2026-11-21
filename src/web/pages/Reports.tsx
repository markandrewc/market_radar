import { useEffect, useId, useState } from 'react';
import type { FormEvent } from 'react';
import { useDigestPreview, useRoles, useSubscribe } from '../api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DigestPreview } from '@/components/DigestPreview';
import { Empty, Loading } from '@/components/Status';

type Cadence = 'weekly' | 'monthly';

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
};

/** The extra sections that are not tied to a single role, rendered as an accessible switch. */
function TopicSwitch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (next: boolean) => void }) {
  const labelId = useId();
  return (
    <div className="flex items-center justify-between gap-3">
      <span id={labelId} className="text-sm text-slate-700">
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent ${
          checked ? 'bg-brand-accent' : 'bg-slate-300'
        }`}
      >
        <span
          aria-hidden="true"
          className={`block h-4 w-4 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}

/** Next run and unsubscribe link, shown whenever the backend returns them. */
function ResultDetails({ nextRun, unsubscribeUrl }: { nextRun?: string | null; unsubscribeUrl?: string | null }) {
  if (!nextRun && !unsubscribeUrl) return null;
  return (
    <div className="space-y-1 text-xs">
      {nextRun ? <p>Next briefing: {formatDateTime(nextRun)}</p> : null}
      {unsubscribeUrl ? (
        <p>
          <a href={unsubscribeUrl} target="_blank" rel="noreferrer" className="underline">
            Unsubscribe link
          </a>
        </p>
      ) : null}
    </div>
  );
}

export default function Reports() {
  const roles = useRoles();
  const preview = useDigestPreview();
  const subscribe = useSubscribe();

  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [includePolicy, setIncludePolicy] = useState(true);
  const [includeTargetGroup, setIncludeTargetGroup] = useState(false);
  const [cadence, setCadence] = useState<Cadence>('weekly');
  const [email, setEmail] = useState('');
  const [topicsReady, setTopicsReady] = useState(false);

  const roleList = roles.data;

  // Start with every role selected so the first preview already shows a real briefing.
  useEffect(() => {
    if (topicsReady || !roleList) return;
    setSelectedRoleIds(roleList.map((role) => role.id));
    setTopicsReady(true);
  }, [roleList, topicsReady]);

  const hasTopic = selectedRoleIds.length > 0 || includePolicy || includeTargetGroup;

  // Live preview: refresh whenever the chosen topics change (and once the roles are known).
  useEffect(() => {
    if (!topicsReady || !hasTopic) return;
    preview.mutate({ roleIds: selectedRoleIds, includePolicy, includeTargetGroup });
    // preview.mutate is stable; the effect is meant to run only when the topics change.
  }, [topicsReady, hasTopic, selectedRoleIds, includePolicy, includeTargetGroup]);

  if (roles.isLoading) return <Loading />;
  if (roles.error || !roleList) {
    return <p className="text-red-700">Could not load the topics. Please refresh the page and try again.</p>;
  }

  const toggleRole = (id: string) =>
    setSelectedRoleIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const chosenTopics = [
    ...roleList.filter((role) => selectedRoleIds.includes(role.id)).map((role) => role.name),
    ...(includePolicy ? ['Policy watch'] : []),
    ...(includeTargetGroup ? ['Target group'] : []),
  ];
  const topicSummary = chosenTopics.length
    ? `You will get the briefing ${cadence === 'weekly' ? 'each week' : 'each month'}: ${chosenTopics.join(', ')}.`
    : 'Choose at least one topic above to get a briefing.';

  const refreshPreview = () => {
    if (!hasTopic) return;
    preview.mutate({ roleIds: selectedRoleIds, includePolicy, includeTargetGroup });
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!hasTopic) return;
    subscribe.mutate({
      email: email.trim(),
      roleIds: selectedRoleIds,
      includePolicy,
      includeTargetGroup,
      cadence,
    });
  };

  const result = subscribe.data;

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold text-brand">Weekly briefing</h2>
        <p className="text-sm text-slate-500">
          A short e-mail that tells you what changed in the Swiss IT job market for the topics you choose.
        </p>
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Topics</CardTitle>
              <CardDescription>Pick what the briefing should cover. Choose at least one topic.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-slate-700">Roles</legend>
                <div className="space-y-1.5">
                  {roleList.map((role) => (
                    <label key={role.id} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={selectedRoleIds.includes(role.id)}
                        onChange={() => toggleRole(role.id)}
                        className="h-4 w-4 accent-brand-accent"
                      />
                      {role.name}
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="space-y-2 border-t border-slate-100 pt-3">
                <legend className="text-sm font-medium text-slate-700">More sections</legend>
                <TopicSwitch label="Policy watch" checked={includePolicy} onChange={setIncludePolicy} />
                <TopicSwitch label="Target group" checked={includeTargetGroup} onChange={setIncludeTargetGroup} />
              </fieldset>

              <fieldset className="space-y-2 border-t border-slate-100 pt-3">
                <legend className="text-sm font-medium text-slate-700">How often</legend>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="cadence"
                      value="weekly"
                      checked={cadence === 'weekly'}
                      onChange={() => setCadence('weekly')}
                      className="h-4 w-4 accent-brand-accent"
                    />
                    Weekly
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="cadence"
                      value="monthly"
                      checked={cadence === 'monthly'}
                      onChange={() => setCadence('monthly')}
                      className="h-4 w-4 accent-brand-accent"
                    />
                    Monthly
                  </label>
                </div>
              </fieldset>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Subscribe</CardTitle>
              <CardDescription>We send the first briefing right away so you can see the format.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={submit}>
                <div>
                  <label htmlFor="subscribe-email" className="block text-sm font-medium text-slate-700">
                    E-mail address
                  </label>
                  <input
                    id="subscribe-email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    aria-describedby="subscribe-summary"
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-accent focus:outline-none"
                  />
                </div>

                <p id="subscribe-summary" className="text-xs text-slate-500">
                  {topicSummary}
                </p>

                <div className="space-y-2">
                  <button
                    type="submit"
                    disabled={!hasTopic || subscribe.isPending}
                    className="rounded-md bg-brand-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {subscribe.isPending ? 'Subscribing…' : 'Subscribe'}
                  </button>
                  {!hasTopic ? (
                    <p className="text-xs text-amber-800">Choose at least one topic to enable subscribing.</p>
                  ) : null}
                </div>

                {subscribe.isError ? (
                  <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                    {subscribe.error.message}
                  </p>
                ) : null}

                {result?.sent === true ? (
                  <div role="status" className="space-y-1 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                    <p className="font-medium">Sent — check your inbox</p>
                    <ResultDetails nextRun={result.nextRun} unsubscribeUrl={result.unsubscribeUrl} />
                  </div>
                ) : null}

                {result && result.sent === false ? (
                  <div role="status" className="space-y-1 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    <p className="font-medium">Saved, but the e-mail was not sent</p>
                    {result.error ? <p className="break-words text-xs">{result.error}</p> : null}
                    <ResultDetails nextRun={result.nextRun} unsubscribeUrl={result.unsubscribeUrl} />
                  </div>
                ) : null}
              </form>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>This is what the e-mail will look like. It updates when you change the topics.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-500">
                {preview.isPending ? 'Building the preview…' : 'Built from the topics above.'}
              </p>
              <button
                type="button"
                onClick={refreshPreview}
                disabled={!hasTopic || preview.isPending}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-brand-accent hover:text-brand-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                Refresh preview
              </button>
            </div>

            {!hasTopic ? (
              <Empty text="Choose at least one topic to see a preview." />
            ) : preview.isError ? (
              <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {preview.error.message}
              </p>
            ) : preview.data ? (
              <DigestPreview digest={preview.data} />
            ) : (
              <Loading />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

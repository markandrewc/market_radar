import { useEffect, useId, useState } from 'react';
import { Check, Download, Landmark, Target, Users } from 'lucide-react';
import type { FormEvent } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useDigestPreview, useRoles, useSubscribe } from '../api';
import { SectionHeader } from '@/components/SectionHeader';
import { DigestPreview } from '@/components/DigestPreview';
import { EmailFrame } from '@/components/EmailFrame';
import { PageHeader } from '@/components/PageHeader';
import { ProvenanceFooter } from '@/components/ProvenanceFooter';
import { Button } from '@/components/ui/button';
import { Empty, Loading } from '@/components/Status';
import { Pagination } from '@/components/ui/pagination';
import { usePaged } from '../hooks';
import { downloadDigestPdf } from '../lib/digestPdf';
import { cn } from '@/lib/utils';

type Cadence = 'weekly' | 'monthly';

const ROLES_PER_PAGE = 6;

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
};

/**
 * One module of the briefing: a quiet glyph, its name and the real control. The
 * heading is the accessible name of the switch, so nothing is announced twice.
 */
function ModuleToggle({
  title,
  icon: Icon,
  checked,
  onChange,
}: {
  title: string;
  icon: LucideIcon;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  const titleId = useId();
  return (
    <div className="flex items-center gap-3 p-5">
      <span aria-hidden className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-accent">
        <Icon className="h-4 w-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3">
        <h3 id={titleId} className="text-sm font-semibold text-ink">
          {title}
        </h3>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-labelledby={titleId}
          onClick={() => onChange(!checked)}
          className={cn(
            'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-line transition-colors',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent',
            checked ? 'bg-brand-accent' : 'bg-brand-soft',
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              'block h-4 w-4 rounded-full bg-surface shadow-card transition-transform',
              checked ? 'translate-x-4' : 'translate-x-0.5',
            )}
          />
        </button>
      </div>
    </div>
  );
}

/** Next run and unsubscribe link, shown whenever the backend returns them. */
function ResultDetails({ nextRun, unsubscribeUrl }: { nextRun?: string | null; unsubscribeUrl?: string | null }) {
  if (!nextRun && !unsubscribeUrl) return null;
  return (
    <div className="space-y-1 text-xs text-ink-soft">
      {nextRun ? <p>Next briefing: {formatDateTime(nextRun)}</p> : null}
      {unsubscribeUrl ? (
        <p>
          <a href={unsubscribeUrl} target="_blank" rel="noreferrer" className="font-medium text-brand-accent underline decoration-brand-accent/30 underline-offset-2 hover:text-accent-deep">
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
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState(false);

  const roleList = roles.data;
  const rolePages = usePaged(roleList ?? [], ROLES_PER_PAGE);

  const hasTopic = selectedRoleIds.length > 0 || includePolicy || includeTargetGroup;

  // Live preview: refresh whenever the chosen topics change (and once the roles are known).
  useEffect(() => {
    if (!hasTopic) return;
    preview.mutate({ roleIds: selectedRoleIds, includePolicy, includeTargetGroup });
    // preview.mutate is stable; the effect is meant to run only when the topics change.
  }, [hasTopic, selectedRoleIds, includePolicy, includeTargetGroup]);

  const header = (
    <PageHeader
      kicker="BRIEFINGS"
      title="Weekly report"
      description="A short e-mail that tells you what changed in the Swiss IT job market for the topics you choose. We only store your e-mail address and your choices, and every e-mail carries an unsubscribe link."
    />
  );

  if (roles.isLoading) {
    return (
      <div className="space-y-8">
        {header}
        <Loading />
      </div>
    );
  }
  if (roles.error || !roleList) {
    return (
      <div className="space-y-8">
        {header}
        <p role="alert" className="rounded-card border border-line bg-accent-soft px-4 py-3 text-sm text-ink">
          Could not load the topics. Please refresh the page and try again.
        </p>
      </div>
    );
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
  const digest = preview.data;

  const downloadPdf = async () => {
    if (!digest) return;
    setPdfBusy(true); setPdfError(false);
    try { await downloadDigestPdf(digest); } catch { setPdfError(true); } finally { setPdfBusy(false); }
  };

  return (
    <div className="space-y-10">
      {header}

      <div className="grid items-start gap-8 lg:grid-cols-2 lg:gap-10">
        {/* ---- Left column: what the briefing covers, then how it is delivered ---- */}
        <div className="space-y-8">
          <section aria-labelledby="reports-topics" className="space-y-4">
            <SectionHeader
              id="reports-topics"
              kicker="TOPICS"
              title="Topics"
              description="Pick what the briefing should cover. Choose at least one topic."
            />
            <div className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface shadow-card">
              {/* Module 1: roles, with the real checkboxes and their pagination. */}
              <section aria-labelledby="module-roles" className="p-5">
                <div className="flex items-center gap-2.5">
                  <span aria-hidden className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-accent">
                    <Users className="h-4 w-4" />
                  </span>
                  <h3 id="module-roles" className="text-sm font-semibold text-ink">Roles</h3>
                </div>
                <div className="mt-3 space-y-2">
                  <ul className="divide-y divide-line border-y border-line">
                    {rolePages.slice.map((role) => (
                      <li key={role.id}>
                        <label className="group flex cursor-pointer items-center gap-3 px-1 py-2.5 text-sm text-ink transition-colors hover:bg-paper">
                          <input
                            type="checkbox"
                            checked={selectedRoleIds.includes(role.id)}
                            onChange={() => toggleRole(role.id)}
                            className="peer sr-only"
                          />
                          <span
                            aria-hidden
                            className={cn(
                              'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border border-line-strong bg-surface text-transparent transition-colors',
                              'peer-checked:border-brand-accent peer-checked:bg-brand-accent peer-checked:text-white',
                              'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-accent',
                            )}
                          >
                            <Check className="h-3 w-3" />
                          </span>
                          <span>{role.name}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                  <Pagination label="Roles pages" page={rolePages.page} pageCount={rolePages.pageCount} total={rolePages.total} size={ROLES_PER_PAGE} onChange={rolePages.setPage} />
                  <p className="tnum text-xs text-ink-soft" aria-live="polite">
                    {selectedRoleIds.length} of {roleList.length} roles selected
                    {selectedRoleIds.length > 0 && (<> · <button type="button" onClick={() => setSelectedRoleIds([])} className="font-medium text-brand-accent underline decoration-brand-accent/30 underline-offset-2 hover:text-accent-deep">Clear</button></>)}
                  </p>
                </div>
              </section>

              {/* Module 2 and 3: the optional sections, each its own honest toggle. */}
              <ModuleToggle title="Policy watch" icon={Landmark} checked={includePolicy} onChange={setIncludePolicy} />
              <ModuleToggle title="Target group" icon={Target} checked={includeTargetGroup} onChange={setIncludeTargetGroup} />
            </div>
          </section>

          <section aria-labelledby="reports-subscribe" className="space-y-4">
            <SectionHeader
              id="reports-subscribe"
              kicker="DELIVERY"
              title="Subscribe"
              description="We send the first briefing right away so you can see the format."
            />
            <div className="rounded-card border border-line bg-surface p-5 shadow-card">
              <form className="space-y-4" onSubmit={submit}>
                <div>
                  <label htmlFor="subscribe-email" className="block text-sm font-medium text-ink">
                    Your email address
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
                    className="mt-1 w-full rounded-control border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-ink-soft/70 transition-colors hover:border-line-strong"
                  />
                </div>

                <p id="subscribe-summary" className="text-xs leading-relaxed text-ink-soft">
                  {topicSummary}
                </p>

                {/* Cadence: paper pills over the real radios, so keyboard and labels stay native. */}
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium text-ink">How often</legend>
                  <div className="inline-flex rounded-control border border-line bg-brand-soft/60 p-1">
                    {([
                      { value: 'weekly', label: 'Weekly' },
                      { value: 'monthly', label: 'Monthly' },
                    ] as const).map((option) => (
                      <label key={option.value} className="relative">
                        <input
                          type="radio"
                          name="cadence"
                          value={option.value}
                          checked={cadence === option.value}
                          onChange={() => setCadence(option.value)}
                          className="peer sr-only"
                        />
                        <span className="block cursor-pointer rounded-control px-4 py-1.5 text-sm text-ink-soft transition-colors peer-checked:bg-surface peer-checked:font-semibold peer-checked:text-ink peer-checked:shadow-card peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-accent">
                          {option.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="space-y-2 border-t border-line pt-4">
                  <p className="kicker">Send test briefing</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="submit" disabled={!hasTopic || subscribe.isPending} className="rounded-control">
                      {subscribe.isPending ? 'Subscribing…' : 'Subscribe'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-control"
                      onClick={downloadPdf}
                      disabled={!hasTopic || !digest || preview.isPending || pdfBusy}
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden />{pdfBusy ? 'Preparing PDF…' : 'Download as PDF'}
                    </Button>
                  </div>
                  {!hasTopic ? (
                    <p className="text-xs text-accent-deep">Choose at least one topic to enable subscribing.</p>
                  ) : null}
                  {pdfError ? <p role="alert" className="text-xs text-accent-deep">The PDF could not be created. Please try again.</p> : null}
                </div>

                {subscribe.isError ? (
                  <p role="alert" className="rounded-control border border-brand-accent/30 bg-accent-soft px-3 py-2 text-sm text-accent-deep">
                    {subscribe.error.message}
                  </p>
                ) : null}

                {result?.sent === true ? (
                  <div role="status" className="space-y-1 rounded-control border border-line bg-paper px-3 py-2.5 text-sm text-ink">
                    <p className="font-medium">Sent — check your inbox</p>
                    <ResultDetails nextRun={result.nextRun} unsubscribeUrl={result.unsubscribeUrl} />
                  </div>
                ) : null}

                {result && result.sent === false ? (
                  <div role="status" className="space-y-1 rounded-control border border-line bg-paper px-3 py-2.5 text-sm text-ink">
                    <p className="font-medium">Saved, but the e-mail was not sent</p>
                    {result.error ? <p className="break-words text-xs text-ink-soft">{result.error}</p> : null}
                    <ResultDetails nextRun={result.nextRun} unsubscribeUrl={result.unsubscribeUrl} />
                  </div>
                ) : null}
              </form>
            </div>
          </section>
        </div>

        {/* ---- Right column: the briefing as it would arrive ---- */}
        <section aria-labelledby="reports-preview" className="space-y-4">
          <SectionHeader
            id="reports-preview"
            kicker="PREVIEW"
            title="Preview"
            description="This is what the e-mail will look like. It updates when you change the topics."
          />
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="meta">{preview.isPending ? 'Building the preview…' : 'Built from the topics above.'}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-control"
                onClick={refreshPreview}
                disabled={!hasTopic || preview.isPending}
              >
                Refresh preview
              </Button>
            </div>

            <EmailFrame
              from="Market Radar"
              to={email.trim() || 'you@example.com'}
              subject={digest?.subject ?? 'Market Radar: your weekly briefing'}
              date={digest ? formatDateTime(digest.generatedAt) : 'Draft'}
            >
              {!hasTopic ? (
                <Empty text="Choose at least one topic to see a preview." />
              ) : preview.isError ? (
                <p role="alert" className="rounded-control border border-brand-accent/30 bg-accent-soft px-3 py-2 text-sm text-accent-deep">
                  {preview.error.message}
                </p>
              ) : digest ? (
                <DigestPreview digest={digest} />
              ) : (
                <Loading />
              )}
            </EmailFrame>

            <ProvenanceFooter sources={digest?.sources ?? []} updatedAt={digest?.generatedAt} />
          </div>
        </section>
      </div>
    </div>
  );
}

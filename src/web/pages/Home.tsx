import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, FileText, Landmark, LineChart, MousePointerClick, ShieldCheck } from 'lucide-react';
import type { PulseMover } from '../../shared/types';
import { ApiError, useDemand, useInsights, useItems, useOverview, useSkills } from '../api';
import { usePageTitle } from '../hooks';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { RoleCard } from '@/components/RoleCard';
import { FreshnessFooter } from '@/components/FreshnessFooter';
import { Glossary } from '@/components/Glossary';
import { ChartFrame } from '@/components/ChartFrame';
import { FilterPills } from '@/components/FilterPills';
import { ForecastChart } from '@/components/ForecastChart';
import { Interpretation } from '@/components/Interpretation';
import { KpiCard } from '@/components/KpiCard';
import { SkillBars } from '@/components/SkillBars';
import { SourceInfo, formatDate } from '@/components/SourceInfo';
import { Empty, ErrorMsg, Loading } from '@/components/Status';
import { monthLabel } from '@/components/DemandBlock';
import { formatPeriod, itemSource } from '../lib/source';

const TOP = 3;
const SKILL_LIMIT = 8;
const numberFormat = new Intl.NumberFormat('en-GB');

const steps = [
  { icon: MousePointerClick, title: '1. Pick a role', text: 'Choose the role below that your graduates go into.' },
  { icon: LineChart, title: '2. Read the trend', text: 'See how many jobs are open and which skills employers ask for.' },
  { icon: ShieldCheck, title: '3. Check the source', text: 'Every number shows where it comes from and when it was updated.' },
];

const next = [
  { to: '/policy', icon: Landmark, title: 'Policy news', text: 'Changes in rules that may affect our participants.' },
  { to: '/reports', icon: FileText, title: 'Weekly reports', text: 'Get a short summary by email.' },
  { to: '/sources', icon: ShieldCheck, title: 'Data sources', text: 'See every source and how current it is.' },
];

/** The sign is always written out, so a rise or fall is never conveyed by colour alone. */
function signedPercent(pct: number): string {
  const rounded = Math.round(pct * 10) / 10;
  return `${rounded > 0 ? '+' : ''}${rounded} %`;
}

function sharePercent(share: number): string {
  return `${Math.round(share * 10) / 10} %`;
}

/**
 * "92 postings · vs. previous month". The count is what a staff member needs next to a
 * percentage, so a move of a handful of postings is not read as a big shift. Older
 * payloads may not carry `current`; then the line falls back to the comparison alone.
 */
function moverDetail(mover: PulseMover): string {
  const current = typeof mover.current === 'number' ? `${numberFormat.format(mover.current)} postings · ` : '';
  return `${current}vs. previous month`;
}

export default function Home({ onHelp }: { onHelp: () => void }) {
  usePageTitle('Job market');
  const demand = useDemand();
  const overview = useOverview();
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

  // The chart's role: the most open role by default. A choice the visitor made stays
  // put when React Query refetches, because it is looked up by id, not by position.
  const demandSorted = demand.data ? [...demand.data].sort((a, b) => b.current - a.current) : [];
  const active = demandSorted.find((d) => d.role.id === selectedRoleId) ?? demandSorted[0];
  const activeId = active?.role.id ?? '';

  const demandInsight = useInsights(activeId ? { role: activeId, kind: 'demand' } : { kind: 'demand' });
  const roleSkillsInsight = useInsights(activeId ? { role: activeId, kind: 'skills' } : { kind: 'skills' });
  const allSkillsInsight = useInsights({ kind: 'skills' });
  const skills = useSkills(activeId || undefined);
  // A few more than three, so picking the three newest is right even when the
  // records arrive in another order (the live API already sorts by publisher date).
  const policy = useItems({ category: 'E', limit: 10 });

  const latest = demand.data?.map((d) => d.source.fetchedAt).sort().at(-1);
  const top = demand.data ? demandSorted.slice(0, TOP) : [];

  // ---- This week's pulse: four headline numbers, all from useOverview() ----
  const pulse = overview.data;
  const postings = pulse?.postings ?? null;
  const riser = pulse?.biggestRiser ?? null;
  const faller = pulse?.biggestFaller ?? null;
  const health = pulse?.sources ?? null;
  const sourceTotal = health ? health.ok + health.stale + health.error : 0;
  // `postings.value` is the count of the single busiest role; `base` is the sample of all
  // IT postings. The sample is what the headline may claim, never one role's count.
  const postingsLabel = !postings || postings.base != null ? 'IT postings in the sample' : 'IT postings for the busiest role';
  const postingsValue = postings ? numberFormat.format(postings.base ?? postings.value) : pulse ? 'No figure yet' : '…';
  const postingsDetail = postings
    ? [
        formatPeriod(postings.period),
        postings.base != null
          ? `busiest role: ${numberFormat.format(postings.value)} postings`
          : 'postings for the busiest role',
      ]
        .filter(Boolean)
        .join(' · ')
    : pulse
      ? 'The monthly count is not available yet.'
      : 'Loading the latest numbers…';
  // A labelled skeleton in the same four columns, so the pulse keeps its shape while it loads.
  const loadingValue = (
    <span aria-hidden className="inline-block h-8 w-24 rounded-md bg-slate-200 motion-safe:animate-pulse" />
  );

  // ---- Demand chart: one role at a time, default the role with the most postings ----
  const demandRows = active
    ? [...active.series]
        .sort((a, b) => b.period.localeCompare(a.period))
        .map((point) => [monthLabel(point.period), point.value])
    : [];

  // ---- Skills chart: the same role, so both charts tell one story ----
  const skillRows = skills.data
    ? [...skills.data.skills].sort((a, b) => b.share - a.share).slice(0, SKILL_LIMIT)
    : [];
  const firstSkill = skillRows[0];
  const skillsReady = Boolean(skills.data && skills.data.skills.length > 0);
  const skillsFailed = Boolean(skills.error) && !(skills.error instanceof ApiError && skills.error.status === 404);
  // A role-specific reading when we have one, otherwise the all-roles reading.
  const skillsInsight = skillsReady ? (roleSkillsInsight.data?.[0] ?? allSkillsInsight.data?.[0]) : undefined;

  // ---- Regions: only when the overview carries a regional insight (never invented) ----
  const regionInsight = pulse?.insights.find((insight) => insight.kind === 'regions');

  // Plain-language "Explain simply" targets; the server resolves them to the same facts.
  const demandInsightItem = demandInsight.data?.[0];

  // ---- Policy: the three newest published records ----
  const policyItems = [...(policy.data ?? [])]
    .sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''))
    .slice(0, 3);

  return (
    <div className="space-y-10">
      <section className="rounded-2xl bg-brand px-6 py-10 text-white">
        <p className="text-sm font-medium uppercase tracking-widest text-rose-200">Market Radar</p>
        <h1 className="mt-2 max-w-2xl text-3xl font-bold sm:text-4xl">See which IT skills Swiss employers are looking for.</h1>
        <p className="mt-3 max-w-2xl text-slate-200">How many jobs are open for the roles our graduates go into, which skills are asked for, and how that changed over the months.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a href="#roles" className="inline-flex min-h-10 items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-brand hover:bg-slate-100">Start with a role <ArrowRight className="h-4 w-4" aria-hidden /></a>
          <Button variant="outline" onClick={onHelp} className="border-white/60 bg-transparent text-white hover:bg-white/10">Take a quick tour</Button>
        </div>
      </section>

      <section aria-labelledby="pulse-title" className="space-y-4">
        <div>
          <h2 id="pulse-title" className="text-2xl font-semibold text-brand">This week's pulse</h2>
          <p className="text-slate-700">What changed this week for the roles our graduates go into: how many IT postings we saw, the biggest moves, and whether our sources are up to date.</p>
        </div>
        {pulse ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <li>
              <KpiCard
                label={postingsLabel}
                value={postingsValue}
                detail={postingsDetail}
                source={postings?.source}
              />
            </li>
            <li>
              <KpiCard
                label="Biggest riser"
                value={riser ? riser.role.name : 'No role is rising'}
                changePct={riser?.changePct}
                detail={riser ? moverDetail(riser) : 'Every role held or fell.'}
                source={riser?.source}
              />
            </li>
            <li>
              <KpiCard
                label="Biggest faller"
                value={faller ? faller.role.name : 'No role is falling'}
                changePct={faller?.changePct}
                detail={faller ? moverDetail(faller) : 'Every role held or grew.'}
                source={faller?.source}
              />
            </li>
            <li>
              <KpiCard
                label="Sources up to date"
                value={health ? `${health.ok} of ${sourceTotal}` : 'No status yet'}
                detail={health ? `stale: ${health.stale} · problems: ${health.error}` : 'The source status is not available yet.'}
              />
              <Link to="/sources" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-accent underline underline-offset-2 hover:text-brand">
                Check the sources <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </li>
          </ul>
        ) : overview.error ? (
          <ErrorMsg onRetry={() => overview.refetch()} />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Loading this week's pulse">
            {['IT postings in the sample', 'Biggest riser', 'Biggest faller', 'Sources up to date'].map((label) => (
              <li key={label}>
                <KpiCard label={label} value={loadingValue} detail="Loading the latest numbers…" />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="how-title" className="space-y-4">
        <h2 id="how-title" className="text-xl font-semibold text-brand">How it works</h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {steps.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-4">
              <Icon className="mt-0.5 h-6 w-6 shrink-0 text-brand-accent" aria-hidden />
              <div><h3 className="font-semibold text-brand">{title}</h3><p className="text-sm text-slate-700">{text}</p></div>
            </li>
          ))}
        </ol>
      </section>

      <section id="roles" aria-labelledby="roles-title" className="scroll-mt-6 space-y-4">
        <div>
          <h2 id="roles-title" className="text-2xl font-semibold text-brand">Job market by role</h2>
          <p className="text-slate-700">The roles with the most open positions right now. Click a role name to see its trend, skills and employers.</p>
        </div>
        {demand.isLoading && <Loading />}
        {demand.error && <ErrorMsg onRetry={() => demand.refetch()} />}
        {demand.data && demand.data.length === 0 && <Empty text="There is no data yet. The first update has not run. Please check back later." />}
        {top.length > 0 && (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {top.map((d) => <li key={`${d.role.id}-${d.source.id}`}><RoleCard d={d} /></li>)}
          </ul>
        )}
        {demand.data && demand.data.length > TOP && (
          <p>
            <Link to="/roles" className="inline-flex min-h-10 items-center gap-2 rounded-md bg-brand-accent px-5 py-2 text-sm font-medium text-white hover:bg-[#8f2943]">
              Show all {demand.data.length} roles <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </p>
        )}
        {latest && <FreshnessFooter fetchedAt={latest} />}
      </section>

      {active && (
        <section aria-label="Demand for the roles we train for">
          <ChartFrame
            title="Demand for the roles we train for"
            description="Monthly job postings in Switzerland for one role. The dashed part is a forecast."
            filters={
              <div className="w-72 max-w-full sm:w-80">
                <FilterPills
                  label="Choose a role"
                  options={demandSorted.map((d) => ({ value: d.role.id, label: d.role.name }))}
                  value={active.role.id}
                  onChange={setSelectedRoleId}
                />
              </div>
            }
            numbers={{
              caption: 'Reported postings per month',
              head: ['Month', 'Reported postings'],
              rows: demandRows,
            }}
            sources={[active.source]}
          >
            <div className="space-y-4">
              <ForecastChart series={active.series} forecast={active.trend?.forecast} label={`${active.role.name} demand`} />
              {demandInsightItem && (
                <Interpretation
                  insight={demandInsightItem}
                  explain={{ kind: 'insight', insightId: demandInsightItem.id }}
                />
              )}
            </div>
          </ChartFrame>
        </section>
      )}

      <section aria-label="Skills employers ask for">
        <ChartFrame
          title="Skills employers ask for"
          description="Share of postings that mention the skill; the change is compared with the previous month."
          numbers={
            skillRows.length > 0
              ? {
                  caption: 'Skills and their share of postings',
                  head: ['Skill', 'Share of postings', 'Change vs. previous month'],
                  rows: skillRows.map((skill) => [skill.skill, sharePercent(skill.share), signedPercent(skill.changePct)]),
                }
              : undefined
          }
          sources={firstSkill ? [firstSkill.source] : undefined}
        >
          <div className="space-y-4">
            {skills.isLoading ? (
              <Skeleton className="h-48" />
            ) : skillsFailed ? (
              <ErrorMsg onRetry={() => skills.refetch()} />
            ) : (
              <SkillBars skills={skills.data?.skills ?? []} limit={SKILL_LIMIT} />
            )}
            {skillsInsight && (
              <Interpretation insight={skillsInsight} explain={{ kind: 'insight', insightId: skillsInsight.id }} />
            )}
          </div>
        </ChartFrame>
      </section>

      {regionInsight && (
        <section aria-labelledby="regions-title" className="space-y-4">
          <h2 id="regions-title" className="text-2xl font-semibold text-brand">Open positions by region</h2>
          <Card>
            <CardContent className="space-y-4 pt-5">
              <Interpretation
                insight={regionInsight}
                explain={{ kind: 'insight', insightId: regionInsight.id }}
              />
              {regionInsight.evidence.length > 0 && (
                <dl className="grid gap-3 sm:grid-cols-2">
                  {regionInsight.evidence.map((row, index) => (
                    <div key={`${row.label}-${index}`} className="rounded-md border border-slate-200 p-3">
                      <dt className="text-sm font-medium text-slate-800">{row.label}</dt>
                      <dd className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-700">
                        <span>{row.value}</span>
                        <SourceInfo source={row.source} />
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
              <p className="text-sm text-slate-700">BFS publishes these figures quarterly, so they move more slowly than the monthly series.</p>
            </CardContent>
          </Card>
        </section>
      )}

      {policyItems.length > 0 && (
        <section aria-labelledby="policy-title" className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="policy-title" className="text-2xl font-semibold text-brand">Policy in 30 seconds</h2>
            <Link to="/policy" className="inline-flex items-center gap-1 text-sm font-medium text-brand-accent underline underline-offset-2 hover:text-brand">
              All policy news <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {policyItems.map((item) => (
              <li key={item.id}>
                <Card className="h-full">
                  <CardContent className="space-y-3 pt-5">
                    <p className="text-xs text-slate-600">
                      {item.published_at ? (
                        <time dateTime={item.published_at}>{formatDate(item.published_at)}</time>
                      ) : (
                        'Publisher date not stated'
                      )}
                    </p>
                    <a
                      href={item.url ?? item.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="block text-base font-semibold text-brand underline-offset-2 hover:text-brand-accent hover:underline"
                    >
                      <h3>{item.title}</h3>
                    </a>
                    <SourceInfo source={itemSource(item)} />
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="next-title" className="space-y-4">
        <h2 id="next-title" className="text-xl font-semibold text-brand">Where to go next</h2>
        <ul className="grid gap-4 sm:grid-cols-3">
          {next.map(({ to, icon: Icon, title, text }) => (
            <li key={to}>
              <Link to={to} className="flex h-full gap-3 rounded-xl border border-slate-200 bg-white p-4 hover:border-brand-accent hover:bg-brand-soft">
                <Icon className="mt-0.5 h-6 w-6 shrink-0 text-brand-accent" aria-hidden />
                <span><span className="block font-semibold text-brand">{title}</span><span className="text-sm text-slate-700">{text}</span></span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="unknown-title" className="space-y-2">
        <h2 id="unknown-title" className="text-xl font-semibold text-brand">What we don't know yet</h2>
        <p className="max-w-3xl text-slate-700">
          The monthly demand figures are national, not city-level, so they do not say whether a job is in Zürich or in Bern. The
          employer view only has data while Adzuna access keys are configured and the source has been synced; without them it stays
          empty on purpose. And our policy coverage shows what has been published, not what is being planned.
        </p>
      </section>

      <Glossary />
    </div>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Briefcase,
  FileText,
  Info,
  Landmark,
  LineChart,
  MousePointerClick,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import type { Insight, PulseMover, SourceRef } from '../../shared/types';
import { ApiError, useDemand, useInsights, useItems, useOverview, useSkills } from '../api';
import { usePageTitle } from '../hooks';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChartFrame } from '@/components/ChartFrame';
import { FilterPills } from '@/components/FilterPills';
import { ForecastChart } from '@/components/ForecastChart';
import { FreshnessFooter } from '@/components/FreshnessFooter';
import { Glossary } from '@/components/Glossary';
import { Interpretation } from '@/components/Interpretation';
import { KpiCard } from '@/components/KpiCard';
import { ProvenanceFooter } from '@/components/ProvenanceFooter';
import { RoleCard } from '@/components/RoleCard';
import { SectionHeader } from '@/components/SectionHeader';
import { SkillBars } from '@/components/SkillBars';
import { SourceBadge } from '@/components/SourceBadge';
import { SourceInfo, formatDate } from '@/components/SourceInfo';
import { Empty, ErrorMsg, Loading } from '@/components/Status';
import { monthLabel } from '@/components/DemandBlock';
import { formatPeriod, itemSource } from '../lib/source';

const TOP = 3;
// The compact role strip under the hero: "All roles" plus the busiest roles, because
// every chart below answers one question for one role at a time.
const STRIP = 6;
const ALL_ROLES = 'all';
const SKILL_LIMIT = 8;
const numberFormat = new Intl.NumberFormat('en-GB');

const steps = [
  { icon: MousePointerClick, title: 'Pick a role', text: 'Choose the role below that your graduates go into.' },
  { icon: LineChart, title: 'Read the trend', text: 'See how many jobs are open and which skills employers ask for.' },
  { icon: ShieldCheck, title: 'Check the source', text: 'Every number shows where it comes from and when it was updated.' },
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

/** One hairline row in the hero's floating card: a small label, a tabular number and its source. */
function HeroStat({ label, value, meta, source }: { label: string; value: string; meta?: string; source?: SourceRef }) {
  return (
    <li className="flex flex-col gap-1 py-3 first:pt-1 last:pb-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">{label}</p>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1.5">
        <span className="tnum text-lg font-semibold leading-tight tracking-tight text-ink">{value}</span>
        {source && <SourceBadge source={source} compact />}
      </div>
      {meta && <p className="tnum text-xs text-ink-soft">{meta}</p>}
    </li>
  );
}

export default function Home({ onHelp }: { onHelp: () => void }) {
  usePageTitle('Job market');
  const demand = useDemand();
  const overview = useOverview();
  // "All roles" is the default: the skills question then covers every posting and the
  // hiring-volume question keeps the busiest role (the monthly series is always per role).
  const [selectedRole, setSelectedRole] = useState<string>(ALL_ROLES);

  // The chart's role: the selected role, or the most open role in the "All roles" view.
  // A choice the visitor made stays put when React Query refetches, because it is looked
  // up by id, not by position.
  const demandSorted = demand.data ? [...demand.data].sort((a, b) => b.current - a.current) : [];
  const active = demandSorted.find((d) => d.role.id === selectedRole) ?? demandSorted[0];
  const activeId = active?.role.id ?? '';

  const demandInsight = useInsights(activeId ? { role: activeId, kind: 'demand' } : { kind: 'demand' });
  const roleSkillsInsight = useInsights(
    selectedRole === ALL_ROLES ? { kind: 'skills' } : { role: selectedRole, kind: 'skills' },
  );
  const allSkillsInsight = useInsights({ kind: 'skills' });
  const skills = useSkills(selectedRole === ALL_ROLES ? undefined : selectedRole);
  // A few more than three, so picking the three newest is right even when the
  // records arrive in another order (the live API already sorts by publisher date).
  const policy = useItems({ category: 'E', limit: 10 });

  const latest = demand.data?.map((d) => d.source.fetchedAt).sort().at(-1);
  const top = demand.data ? demandSorted.slice(0, TOP) : [];
  const roleCount = demand.data?.length ?? 0;
  // The strip drives both chart sections; "All roles" is always the first choice.
  const roleOptions = [
    { value: ALL_ROLES, label: 'All roles' },
    ...demandSorted.slice(0, STRIP).map((d) => ({ value: d.role.id, label: d.role.name })),
  ];

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
    <span aria-hidden className="inline-block h-8 w-24 rounded-md bg-line/60 motion-safe:animate-pulse" />
  );

  // The hero card's three rows: the same overview facts, each with its own source pill.
  const heroRows = pulse
    ? [
        {
          label: 'Postings in the sample',
          value: postingsValue,
          meta: postings ? postingsDetail : 'The monthly count is not available yet.',
          source: postings?.source,
        },
        {
          label: 'Largest increase',
          value: riser ? riser.role.name : 'No role is rising',
          meta: riser ? `${signedPercent(riser.changePct)} · ${moverDetail(riser)}` : 'Every role held or fell.',
          source: riser?.source,
        },
        {
          label: 'Largest decrease',
          value: faller ? faller.role.name : 'No role is falling',
          meta: faller ? `${signedPercent(faller.changePct)} · ${moverDetail(faller)}` : 'Every role held or grew.',
          source: faller?.source,
        },
      ]
    : [];

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
  const skillsInsight: Insight | undefined = skillsReady
    ? (roleSkillsInsight.data?.[0] ?? allSkillsInsight.data?.[0])
    : undefined;

  // ---- Regions: only when the overview carries a regional insight (never invented) ----
  const regionInsight = pulse?.insights.find((insight) => insight.kind === 'regions');
  // The regional ledger cites the sources of its own evidence rows, and dates the
  // footer with the newest retrieval among them.
  const regionSources = regionInsight ? regionInsight.evidence.map((row) => row.source) : [];
  const regionUpdatedAt = regionSources.map((source) => source.fetchedAt).sort().at(-1);

  // Plain-language "Explain simply" targets; the server resolves them to the same facts.
  const demandInsightItem = demandInsight.data?.[0];

  // ---- Policy: the three newest published records ----
  const policyItems = [...(policy.data ?? [])]
    .sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''))
    .slice(0, 3);

  return (
    <div className="space-y-14 sm:space-y-16">
      {/* Hero: graphite panel, dotted paper texture, crimson glow and the live numbers card. */}
      <section className="relative rounded-[1.5rem] bg-brand text-paper">
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[1.5rem]">
          <div className="paper-dots absolute inset-0 opacity-[0.14] invert" />
          <div className="hero-glow absolute inset-0" />
        </div>
        <div className="relative grid gap-8 p-6 sm:p-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-200">MARKET RADAR · WEEKLY PULSE</p>
            <h1 className="display mt-4 max-w-2xl text-4xl text-paper sm:text-5xl lg:text-6xl">
              See which IT skills Swiss employers are looking for.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-paper/75 sm:text-lg">
              How many jobs are open for the roles our graduates go into, which skills are asked for, and how that changed over the months.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="#roles"
                className="inline-flex min-h-10 items-center gap-2 rounded-control bg-surface px-5 py-2.5 text-sm font-semibold text-brand shadow-card transition-colors hover:bg-paper focus-visible:outline-paper"
              >
                Start with a role <ArrowRight className="h-4 w-4" aria-hidden />
              </a>
              <Button
                variant="outline"
                onClick={onHelp}
                className="min-h-10 border-paper/40 bg-transparent text-paper hover:bg-white/10 hover:text-paper focus-visible:outline-paper"
              >
                Take a quick tour
              </Button>
            </div>
          </div>

          <aside aria-labelledby="hero-numbers-title" className="rounded-card bg-surface p-5 text-ink shadow-float">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-line pb-3">
              <h2 id="hero-numbers-title" className="text-base font-semibold tracking-tight text-ink">This week in numbers</h2>
              {pulse && <span className="tnum text-[11px] text-ink-soft">Updated {formatDate(pulse.generatedAt)}</span>}
            </div>
            {pulse ? (
              <ul className="divide-y divide-line">
                {heroRows.map((row) => (
                  <HeroStat key={row.label} label={row.label} value={row.value} meta={row.meta} source={row.source} />
                ))}
              </ul>
            ) : overview.error ? (
              <div className="pt-4">
                <ErrorMsg onRetry={() => overview.refetch()} />
              </div>
            ) : (
              <div className="space-y-3 pt-4" role="status" aria-live="polite">
                <span className="sr-only">Loading the latest numbers…</span>
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            )}
          </aside>
        </div>
      </section>

      {/* 1. This week's pulse */}
      <section id="pulse" data-tour="pulse" aria-labelledby="pulse-title" className="space-y-6">
        <SectionHeader
          id="pulse-title"
          kicker="WEEKLY PULSE"
          title="This week's pulse"
          description="What changed this week for the roles our graduates go into: how many IT postings we saw, the biggest moves, and whether our sources are up to date."
        />
        {pulse ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <li>
              <KpiCard
                label={postingsLabel}
                value={postingsValue}
                detail={postingsDetail}
                source={postings?.source}
                icon={<Briefcase className="h-4 w-4" aria-hidden />}
              />
            </li>
            <li>
              <KpiCard
                label="Biggest riser"
                value={riser ? riser.role.name : 'No role is rising'}
                changePct={riser?.changePct}
                detail={riser ? moverDetail(riser) : 'Every role held or fell.'}
                source={riser?.source}
                icon={<TrendingUp className="h-4 w-4" aria-hidden />}
              />
            </li>
            <li>
              <KpiCard
                label="Biggest faller"
                value={faller ? faller.role.name : 'No role is falling'}
                changePct={faller?.changePct}
                detail={faller ? moverDetail(faller) : 'Every role held or grew.'}
                source={faller?.source}
                icon={<TrendingDown className="h-4 w-4" aria-hidden />}
              />
            </li>
            <li>
              <KpiCard
                label="Sources up to date"
                value={health ? `${health.ok} of ${sourceTotal}` : 'No status yet'}
                detail={health ? `stale: ${health.stale} · problems: ${health.error}` : 'The source status is not available yet.'}
                icon={<ShieldCheck className="h-4 w-4" aria-hidden />}
              />
              <Link
                to="/sources"
                className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-accent underline decoration-brand-accent/30 underline-offset-4 hover:text-accent-deep"
              >
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

      {/* 2. How it works: three editorial columns on open paper, split by warm rules. */}
      <section aria-labelledby="how-title" className="space-y-6">
        <SectionHeader
          id="how-title"
          kicker="HOW IT WORKS"
          title="How it works"
          description="Three steps from a question about the job market to a source you can check yourself."
        />
        <ol className="grid gap-8 sm:grid-cols-3 sm:gap-0">
          {steps.map(({ icon: Icon, title, text }, index) => (
            <li
              key={title}
              className={
                index > 0
                  ? 'sm:border-l sm:border-line sm:pl-8 sm:pr-4'
                  : 'sm:pr-8 sm:pl-0'
              }
            >
              <span aria-hidden className="tnum block text-5xl font-semibold leading-none text-brand-accent/20">
                0{index + 1}
              </span>
              <div className="mt-4 flex items-center gap-2.5">
                <span aria-hidden className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-brand-accent">
                  <Icon className="h-4 w-4" />
                </span>
                <h3 className="text-xl font-semibold tracking-tight text-ink">{title}</h3>
              </div>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* 3. Job market by role: three cards, then the whole list. */}
      <section id="roles" aria-labelledby="roles-title" className="scroll-mt-32 space-y-6">
        <SectionHeader
          id="roles-title"
          kicker="ROLES"
          title="Job market by role"
          description="The roles with the most open positions right now. Click a role name to see its trend, skills and employers."
          action={
            demand.data && demand.data.length > TOP ? (
              <Link
                to="/roles"
                className="inline-flex min-h-10 items-center gap-2 rounded-control bg-brand-accent px-4 py-2 text-sm font-medium text-white shadow-card transition-colors hover:bg-accent-deep"
              >
                Show all {roleCount} roles <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            ) : undefined
          }
        />
        {demand.isLoading && <Loading />}
        {demand.error && <ErrorMsg onRetry={() => demand.refetch()} />}
        {demand.data && demand.data.length === 0 && (
          <Empty text="There is no data yet. The first update has not run. Please check back later." />
        )}
        {top.length > 0 && (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {top.map((d) => (
              <li key={`${d.role.id}-${d.source.id}`}>
                <RoleCard d={d} />
              </li>
            ))}
          </ul>
        )}
        {latest && <FreshnessFooter fetchedAt={latest} />}
      </section>

      {/* 4 + 5. Hiring volume and skill momentum side by side; one role choice above drives both. */}
      <section aria-label="Hiring volume and skill momentum" className="space-y-4">
        <div data-tour="role-filter" className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-surface px-3 py-2.5 shadow-card sm:px-4">
          <FilterPills
            label="Choose the role both charts follow"
            options={roleOptions}
            value={selectedRole}
            onChange={setSelectedRole}
          />
          <p className="meta">Switzerland-wide · updated {latest ? formatDate(latest) : 'date not available yet'}</p>
        </div>
        <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
        {active && (
          <section data-tour="demand" aria-label="Demand for the roles we train for">
            <ChartFrame
              kicker="Hiring volume"
              title="Demand for the roles we train for"
              description="Monthly job postings in Switzerland for one role. The dashed part is a forecast."
              badge={
                <span className="inline-flex items-center rounded-full border border-line bg-brand-soft px-2.5 py-1 text-xs font-medium text-ink">
                  {selectedRole === ALL_ROLES ? `Busiest role · ${active.role.name}` : `Selected role · ${active.role.name}`}
                </span>
              }
              tourId="chart-source"
              numbers={{
                caption: 'Reported postings per month',
                head: ['Month', 'Reported postings'],
                rows: demandRows,
              }}
              sources={[active.source]}
            >
              <div className="space-y-5">
                <ForecastChart series={active.series} forecast={active.trend?.forecast} label={`${active.role.name} demand`} />
                {demandInsightItem && (
                  <Interpretation insight={demandInsightItem} explain={{ kind: 'insight', insightId: demandInsightItem.id }} />
                )}
              </div>
            </ChartFrame>
          </section>
        )}

        <section aria-label="Skills employers ask for">
          <ChartFrame
            kicker="Skill momentum"
            title="Skills employers ask for"
            description="Share of postings that mention the skill; the change is compared with the previous month."
            badge={
              <span className="inline-flex items-center rounded-full border border-line bg-brand-soft px-2.5 py-1 text-xs font-medium text-ink">
                {selectedRole === ALL_ROLES ? 'All IT postings' : active ? `Role · ${active.role.name}` : 'One role'}
              </span>
            }
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
            <div className="space-y-5">
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
        </div>
      </section>

      {/* 6. Regions: an open editorial list, not another card. */}
      {regionInsight && (
        <section aria-labelledby="regions-title" className="space-y-6">
          <SectionHeader
            id="regions-title"
            kicker="REGIONS"
            title="Open positions by region"
            description="The regional picture from the federal statistics: where the open positions are, and which region is moving."
          />
          <div className="space-y-5">
            <Interpretation insight={regionInsight} explain={{ kind: 'insight', insightId: regionInsight.id }} />
            {regionInsight.evidence.length > 0 && (
              <dl className="divide-y divide-line border-y border-l-2 border-line pl-5 sm:pl-6">
                {regionInsight.evidence.map((row, index) => (
                  <div
                    key={`${row.label}-${index}`}
                    className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 py-3.5"
                  >
                    <dt className="text-sm text-ink-soft">{row.label}</dt>
                    <dd className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
                      <span className="tnum text-base font-semibold text-ink">{row.value}</span>
                      <SourceInfo source={row.source} />
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            <p className="max-w-3xl text-sm leading-relaxed text-ink-soft">
              BFS publishes these figures quarterly, so they move more slowly than the monthly series.
            </p>
            <ProvenanceFooter sources={regionSources} updatedAt={regionUpdatedAt} />
          </div>
        </section>
      )}

      {/* 7. Policy in 30 seconds: hairline ledger rows, not cards. */}
      {policyItems.length > 0 && (
        <section aria-labelledby="policy-title" className="space-y-6">
          <SectionHeader
            id="policy-title"
            kicker="POLICY"
            title="Policy in 30 seconds"
            description="The newest published records that can change what we teach or who we can place."
            action={
              <Link
                to="/policy"
                className="inline-flex items-center gap-1 text-sm font-medium text-brand-accent underline decoration-brand-accent/30 underline-offset-4 hover:text-accent-deep"
              >
                All policy news <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            }
          />
          <ul className="divide-y divide-line border-y border-line">
            {policyItems.map((item) => (
              <li key={item.id} className="group">
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2 py-4">
                  <p className="tnum w-full text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft sm:w-28 sm:shrink-0">
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
                    className="min-w-0 flex-1 underline-offset-4"
                  >
                    <h3 className="text-base font-semibold tracking-tight text-ink transition-colors group-hover:text-brand-accent sm:text-lg">
                      {item.title}
                    </h3>
                  </a>
                  <div className="flex shrink-0 items-center gap-3">
                    <SourceInfo source={itemSource(item)} />
                    <ArrowRight
                      className="h-4 w-4 text-ink-soft transition-colors group-hover:text-brand-accent"
                      aria-hidden
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 8. Where to go next: three quiet cards, one hairline each. */}
      <section aria-labelledby="next-title" className="space-y-6">
        <SectionHeader id="next-title" kicker="KEEP EXPLORING" title="Where to go next" />
        <ul className="grid gap-4 sm:grid-cols-3">
          {next.map(({ to, icon: Icon, title, text }) => (
            <li key={to}>
              <Link
                to={to}
                className="flex h-full flex-col gap-3 rounded-card border border-line bg-surface p-5 transition-colors hover:border-line-strong hover:bg-brand-soft/40"
              >
                <span aria-hidden className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-brand-accent">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="block font-semibold tracking-tight text-ink">{title}</span>
                <span className="text-sm leading-relaxed text-ink-soft">{text}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* 9. What we don't know yet: small print, stated on paper. */}
      <section aria-labelledby="unknown-title" className="space-y-6">
        <SectionHeader id="unknown-title" kicker="HONEST LIMITS" title="What we don't know yet" />
        <div className="flex items-start gap-3 rounded-card border border-line bg-brand-soft p-5">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-brand-accent" aria-hidden />
          <p className="max-w-3xl text-sm leading-relaxed text-ink-soft">
            The monthly demand figures are national, not city-level, so they do not say whether a job is in Zürich or in Bern. The
            employer view only has data while Adzuna access keys are configured and the source has been synced; without them it stays
            empty on purpose. And our policy coverage shows what has been published, not what is being planned.
          </p>
        </div>
      </section>

      {/* 10. Glossary */}
      <Glossary />
    </div>
  );
}

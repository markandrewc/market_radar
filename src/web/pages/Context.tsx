import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { MarketItem } from '../../shared/types';
import { useEmployers, useItems, useOverview, useRoles } from '../api';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FilterPills } from '@/components/FilterPills';
import { PageHeader } from '@/components/PageHeader';
import { ProvenanceFooter } from '@/components/ProvenanceFooter';
import { SourceBadge } from '@/components/SourceBadge';
import { Empty, ErrorMsg, Loading } from '@/components/Status';
import { formatDate, itemSource } from '../lib/source';

/** The hub shows a preview, never the whole list: three rows per card. */
const PREVIEW = 3;
const METRIC_LIMIT = 2;
/** `metrics` also carries date/period metadata; those are not measures. */
const NON_MEASURE_KEYS = new Set(['year', 'period']);

const numberFormat = new Intl.NumberFormat('de-CH');

/** Quiet "open the full page" link at the bottom of a card. */
const openLinkClass =
  'inline-flex items-center gap-1 text-sm font-medium text-brand-accent underline decoration-brand-accent/30 underline-offset-4 transition-colors hover:text-accent-deep';

/** Inline link in a supporting sentence. */
const linkClass =
  'font-medium text-brand-accent underline decoration-brand-accent/30 underline-offset-2 transition-colors hover:text-accent-deep';

/** Newest publisher date first; records without one fall back to retrieval time. */
function newestFirst(items: MarketItem[]): MarketItem[] {
  return [...items].sort((a, b) => {
    const published = (b.published_at ?? '').localeCompare(a.published_at ?? '');
    return published !== 0 ? published : b.fetched_at.localeCompare(a.fetched_at);
  });
}

/** At most two real measures from a record, formatted the Swiss way. */
function measures(metrics: MarketItem['metrics']): [string, number][] {
  return Object.entries(metrics)
    .filter((entry): entry is [string, number] => entry[1] !== null && !NON_MEASURE_KEYS.has(entry[0]))
    .slice(0, METRIC_LIMIT);
}

function MetricRows({ metrics }: { metrics: MarketItem['metrics'] }) {
  const rows = measures(metrics);
  if (rows.length === 0) return <p className="text-sm text-ink-soft">No figures in this record.</p>;
  return (
    <dl className="space-y-1">
      {rows.map(([name, value]) => (
        <div key={name} className="flex items-baseline justify-between gap-3">
          <dt className="text-xs uppercase tracking-[0.12em] text-ink-soft">{name.replace(/_/g, ' ')}</dt>
          <dd className="tnum text-base font-semibold text-ink">{numberFormat.format(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

/** One count with a plain-language label, in tabular figures. */
function RecordCount({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <p className="tnum text-3xl font-semibold tracking-tight text-ink">{numberFormat.format(value)}</p>
      <p className="text-sm text-ink-soft">{label}</p>
    </div>
  );
}

/**
 * Employers: who is hiring for one role. The counts are listings we saw, not an
 * employer's total, and an empty answer names the missing configuration instead of
 * inventing companies.
 */
function EmployersPanel({ roleId }: { roleId: string }) {
  const { data, isLoading, error, refetch } = useEmployers(roleId);

  if (isLoading) return <Loading />;
  if (error) return <ErrorMsg onRetry={() => refetch()} />;
  if (!data || data.employers.length === 0) {
    return (
      <Empty text="Employer data needs ADZUNA_APP_ID and ADZUNA_APP_KEY — configure the source and sync it in Data sources.">
        <Link to="/sources" className={linkClass}>
          Open Data sources
        </Link>
      </Empty>
    );
  }

  const window = data.window ? `${formatDate(data.window.from)} to ${formatDate(data.window.to)}` : null;
  return (
    <>
      <ul className="divide-y divide-line border-y border-line">
        {data.employers.slice(0, PREVIEW).map((employer) => (
          <li key={employer.name} className="space-y-1.5 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h3 className="min-w-0 text-base font-semibold tracking-tight text-ink">
                {employer.sourceUrl ? (
                  <a
                    href={employer.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline-offset-2 transition-colors hover:text-brand-accent hover:underline"
                  >
                    {employer.name}
                  </a>
                ) : (
                  employer.name
                )}
              </h3>
              <p className="tnum text-sm text-ink-soft">
                <span className="font-semibold text-ink">{numberFormat.format(employer.openings)}</span> listing(s) seen
              </p>
            </div>
            {employer.topSkills.length > 0 && (
              <ul aria-label={`Top skills at ${employer.name}`} className="flex flex-wrap gap-1.5">
                {employer.topSkills.map((skill) => (
                  <li key={skill}>
                    <Badge variant="outline">{skill}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      <p className="text-xs leading-relaxed text-ink-soft">
        The number is the listings we saw, not the employer’s total.{window ? ` Postings from ${window}.` : ''}
      </p>
      <ProvenanceFooter sources={[data.source]} updatedAt={data.source.fetchedAt} />
    </>
  );
}

function EmployersCard() {
  const roles = useRoles();
  const [roleId, setRoleId] = useState<string | null>(null);
  const roleOptions = (roles.data ?? []).map((role) => ({ value: role.id, label: role.name }));
  // The first role is the default until someone picks another one.
  const selected = roleId ?? roleOptions[0]?.value ?? '';

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <p className="kicker">Employers</p>
        <CardTitle>Who is hiring</CardTitle>
        <CardDescription>
          Employers seen in the stored postings for one role. Counts are listings we saw, not an employer’s total.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4 p-5 pt-2">
        {roles.isLoading ? (
          <Loading />
        ) : roles.error ? (
          <ErrorMsg onRetry={() => roles.refetch()} />
        ) : roleOptions.length === 0 ? (
          <Empty text="No roles are stored yet, so there is nothing to show employers for.">
            <Link to="/sources" className={linkClass}>
              Open Data sources
            </Link>
          </Empty>
        ) : (
          <>
            <FilterPills
              label="Choose a role for the employer view"
              options={roleOptions}
              value={selected}
              onChange={setRoleId}
            />
            <EmployersPanel roleId={selected} />
          </>
        )}
        <div className="mt-auto pt-1">
          <Link to="/roles" className={openLinkClass}>
            All roles <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function TargetGroupCard() {
  const itemsQuery = useItems({ category: 'D', limit: PREVIEW });
  const overview = useOverview();
  const items = newestFirst(itemsQuery.data ?? []);
  const newest = items[0];
  const count = overview.data?.targetGroupItems ?? items.length;
  const loading = itemsQuery.isLoading || overview.isLoading;
  const error = itemsQuery.error || overview.error;
  const retry = () => {
    itemsQuery.refetch();
    overview.refetch();
  };

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <p className="kicker">Target group</p>
        <CardTitle>Participants in context</CardTitle>
        <CardDescription>Aggregate statistics about the people we support, with no personal data.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4 p-5 pt-2">
        {loading ? (
          <Loading />
        ) : error ? (
          <ErrorMsg onRetry={retry} />
        ) : items.length === 0 ? (
          <Empty text="No participant statistics are stored yet. Run the connector pipeline and sync the configured sources, then reload this page.">
            <Link to="/sources" className={linkClass}>
              Open Data sources
            </Link>
          </Empty>
        ) : (
          <>
            <RecordCount value={count} label="target-group records stored" />
            {newest && (
              <div className="space-y-2 border-t border-line pt-3">
                <p className="kicker text-ink-soft">Newest record loaded here</p>
                <h3 className="text-base font-semibold tracking-tight text-ink">{newest.title}</h3>
                <MetricRows metrics={newest.metrics} />
                <SourceBadge source={itemSource(newest)} />
              </div>
            )}
            <div className="mt-auto space-y-3 pt-1">
              <ProvenanceFooter
                sources={items.map(itemSource)}
                updatedAt={newest?.fetched_at}
              />
              <Link to="/participants" className={openLinkClass}>
                Open target group <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function PolicyNewsCard() {
  const itemsQuery = useItems({ category: 'E', limit: PREVIEW });
  const overview = useOverview();
  const items = newestFirst(itemsQuery.data ?? []);
  // The pulse counts policy records published in the last seven days, not all stored records.
  const count = overview.data?.newPolicyItems ?? items.length;
  const loading = itemsQuery.isLoading || overview.isLoading;
  const error = itemsQuery.error || overview.error;
  const retry = () => {
    itemsQuery.refetch();
    overview.refetch();
  };

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <p className="kicker">Policy &amp; regulation</p>
        <CardTitle>What policy changed</CardTitle>
        <CardDescription>New laws, motions and reporting duties that can change what we teach or who we can place.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4 p-5 pt-2">
        {loading ? (
          <Loading />
        ) : error ? (
          <ErrorMsg onRetry={retry} />
        ) : items.length === 0 ? (
          <Empty text="No policy items are stored yet. Run the connector pipeline and sync the configured sources, then reload this page.">
            <Link to="/sources" className={linkClass}>
              Open Data sources
            </Link>
          </Empty>
        ) : (
          <>
            <RecordCount value={count} label="policy records new in the last 7 days" />
            <ul className="divide-y divide-line border-y border-line">
              {items.map((item) => (
                <li key={item.id} className="space-y-1.5 py-3">
                  <p className="kicker text-ink-soft">
                    {item.published_at ? (
                      <time dateTime={item.published_at}>{formatDate(item.published_at)}</time>
                    ) : (
                      'Publisher date not stated'
                    )}
                  </p>
                  <h3 className="text-base font-semibold tracking-tight text-ink">
                    <a
                      href={item.url ?? item.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline-offset-2 transition-colors hover:text-brand-accent hover:underline"
                    >
                      {item.title}
                    </a>
                  </h3>
                  <SourceBadge source={itemSource(item)} compact />
                </li>
              ))}
            </ul>
            <div className="mt-auto space-y-3 pt-1">
              <ProvenanceFooter sources={items.map(itemSource)} updatedAt={items[0]?.fetched_at} />
              <Link to="/policy" className={openLinkClass}>
                Open policy news <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Level 3 hub: the same data as the Policy and Participants pages, framed as the
 * three questions they answer (C employers, D target group, E policy), each card
 * carrying its own provenance and a link to the full page.
 */
export default function Context() {
  return (
    <div className="space-y-8">
      <PageHeader
        kicker="LEVEL 3"
        title="People, employers & policy"
        description="Who is hiring, who our participants are, and which rules are changing — with the same sources as the rest of the radar."
      />
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        <EmployersCard />
        <TargetGroupCard />
        <PolicyNewsCard />
      </div>
    </div>
  );
}

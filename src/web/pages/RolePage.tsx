import { Link, useParams } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { ApiError, useDemand, useEmployers, useInsights, useSkills } from '../api';
import { usePageTitle } from '../hooks';
import { cn } from '@/lib/utils';
import { DemandBlock } from '@/components/DemandBlock';
import { SkillsBlock } from '@/components/SkillsBlock';
import { EmployersBlock } from '@/components/EmployersBlock';
import { FreshnessFooter } from '@/components/FreshnessFooter';
import { Interpretation } from '@/components/Interpretation';
import { SourceInfo } from '@/components/SourceInfo';
import { Tabs, type TabDef } from '@/components/ui/tabs';
import { Empty, ErrorMsg, Loading } from '@/components/Status';

export default function RolePage() {
  const { id = '' } = useParams();
  const demand = useDemand(36);
  const skills = useSkills(id);
  const employers = useEmployers(id);

  // Our plain-language reading, one query per tab plus the "What to watch" list.
  const demandInsight = useInsights({ role: id, kind: 'demand' });
  const roleSkillsInsight = useInsights({ role: id, kind: 'skills' });
  const allSkillsInsight = useInsights({ kind: 'skills' });
  const employersInsight = useInsights({ role: id, kind: 'employers' });
  const watch = useInsights({ role: id, limit: 3 });

  const d = demand.data?.find((x) => x.role.id === id);
  usePageTitle(d ? d.role.name : 'Role');

  if (demand.isLoading) return <Loading />;
  if (demand.error) return <ErrorMsg onRetry={() => demand.refetch()} />;
  if (!d)
    return (
      <div className="space-y-4">
        <Empty text="We have no data for this role yet.">
          <Link to="/" className="font-medium text-brand-accent underline decoration-brand-accent/30 underline-offset-4">
            Back to all roles
          </Link>
        </Empty>
      </div>
    );

  // A reading for this role when we have one, otherwise the all-roles reading.
  const skillsInsight = roleSkillsInsight.data?.[0] ?? allSkillsInsight.data?.[0];
  const watchItems = (watch.data ?? []).slice(0, 3);

  const tabs: TabDef[] = [
    {
      id: 'demand',
      label: 'Demand',
      content: (
        <div className="space-y-5">
          <DemandBlock data={d} />
          {demandInsight.data?.[0] && (
            <Interpretation
              insight={demandInsight.data[0]}
              explain={{ kind: 'insight', insightId: demandInsight.data[0].id }}
            />
          )}
          {demandInsight.error && <ErrorMsg onRetry={() => demandInsight.refetch()} />}
        </div>
      ),
    },
    {
      id: 'skills',
      label: 'Skills',
      content: skills.isLoading ? (
        <Loading />
      ) : skills.error ? (
        skills.error instanceof ApiError && skills.error.status === 404 ? (
          <Empty text="We have no skill data for this role yet." />
        ) : (
          <ErrorMsg onRetry={() => skills.refetch()} />
        )
      ) : skills.data ? (
        <div className="space-y-5">
          <SkillsBlock data={skills.data} />
          {skillsInsight && (
            <Interpretation insight={skillsInsight} explain={{ kind: 'insight', insightId: skillsInsight.id }} />
          )}
        </div>
      ) : null,
    },
    {
      id: 'employers',
      label: 'Employers',
      content: employers.isLoading ? (
        <Loading />
      ) : employers.error ? (
        <ErrorMsg onRetry={() => employers.refetch()} />
      ) : employers.data ? (
        <div className="space-y-5">
          <EmployersBlock data={employers.data} />
          {employersInsight.data?.[0] && (
            <Interpretation
              insight={employersInsight.data[0]}
              explain={{ kind: 'insight', insightId: employersInsight.data[0].id }}
            />
          )}
        </div>
      ) : null,
    },
  ];

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <nav aria-label="Breadcrumb">
          <ol className="flex items-center gap-1.5 text-sm text-ink-soft">
            <li>
              <Link
                to="/"
                className="font-medium text-brand-accent underline decoration-brand-accent/30 underline-offset-4 hover:text-accent-deep"
              >
                Job market
              </Link>
            </li>
            <li aria-hidden>
              <ChevronRight className="h-4 w-4" />
            </li>
            <li aria-current="page" className="truncate">
              {d.role.name}
            </li>
          </ol>
        </nav>
        <div className="space-y-4">
          <p className="kicker">ROLE</p>
          <h1 className="display text-4xl sm:text-5xl">{d.role.name}</h1>
        </div>
        <nav aria-label="Switch role">
          <ul className="flex flex-wrap gap-2">
            {demand.data!.map((r) => {
              const current = r.role.id === id;
              return (
                <li key={r.role.id}>
                  <Link
                    to={`/roles/${r.role.id}`}
                    aria-current={current ? 'page' : undefined}
                    className={cn(
                      'inline-flex min-h-9 items-center rounded-full border px-4 text-sm font-medium transition-colors',
                      current
                        ? 'border-brand-accent/30 bg-accent-soft text-brand-accent'
                        : 'border-line bg-surface text-ink-soft hover:border-line-strong hover:bg-brand-soft/60 hover:text-ink',
                    )}
                  >
                    {r.role.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      <Tabs key={id} label={`${d.role.name}: demand, skills and employers`} tabs={tabs} />

      {watchItems.length > 0 && (
        <section aria-labelledby="watch-title" className="space-y-5 border-t border-line pt-8">
          <div className="space-y-2">
            <p className="kicker">WATCHLIST</p>
            <h2 id="watch-title" className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              What to watch
            </h2>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {watchItems.map((insight) => (
              <li key={insight.id}>
                <Interpretation insight={insight} explain={{ kind: 'insight', insightId: insight.id }} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-5">
        <FreshnessFooter fetchedAt={d.source.fetchedAt} />
        <SourceInfo source={d.source} />
      </footer>
    </div>
  );
}

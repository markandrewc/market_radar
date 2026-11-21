import { Link, useParams } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { ApiError, useDemand, useEmployers, useInsights, useSkills } from '../api';
import { usePageTitle } from '../hooks';
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
  if (!d) return <div className="space-y-4"><Empty text="We have no data for this role yet."><Link to="/" className="font-medium text-brand-accent underline">Back to all roles</Link></Empty></div>;

  // A reading for this role when we have one, otherwise the all-roles reading.
  const skillsInsight = roleSkillsInsight.data?.[0] ?? allSkillsInsight.data?.[0];
  const watchItems = (watch.data ?? []).slice(0, 3);

  const tabs: TabDef[] = [
    {
      id: 'demand',
      label: 'Demand',
      content: (
        <div className="space-y-4">
          <DemandBlock data={d} />
          {demandInsight.data?.[0] && <Interpretation insight={demandInsight.data[0]} />}
          {demandInsight.error && <ErrorMsg onRetry={() => demandInsight.refetch()} />}
        </div>
      ),
    },
    {
      id: 'skills',
      label: 'Skills',
      content: skills.isLoading ? <Loading />
        : skills.error ? (skills.error instanceof ApiError && skills.error.status === 404 ? <Empty text="We have no skill data for this role yet." /> : <ErrorMsg onRetry={() => skills.refetch()} />)
        : skills.data ? (
          <div className="space-y-4">
            <SkillsBlock data={skills.data} />
            {skillsInsight && <Interpretation insight={skillsInsight} />}
          </div>
        ) : null,
    },
    {
      id: 'employers',
      label: 'Employers',
      content: employers.isLoading ? <Loading />
        : employers.error ? <ErrorMsg onRetry={() => employers.refetch()} />
        : employers.data ? (
          <div className="space-y-4">
            <EmployersBlock data={employers.data} />
            {employersInsight.data?.[0] && <Interpretation insight={employersInsight.data[0]} />}
          </div>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-1 text-sm text-slate-600">
          <li><Link to="/" className="text-brand-accent underline underline-offset-4">Job market</Link></li>
          <li aria-hidden><ChevronRight className="h-4 w-4" /></li>
          <li aria-current="page">{d.role.name}</li>
        </ol>
      </nav>
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold text-brand">{d.role.name}</h1>
        <nav aria-label="Switch role">
          <ul className="flex flex-wrap gap-2">
            {demand.data!.map((r) => (
              <li key={r.role.id}>
                <Link to={`/roles/${r.role.id}`} aria-current={r.role.id === id ? 'page' : undefined}
                  className={`inline-flex min-h-9 items-center rounded-full border px-4 text-sm font-medium ${r.role.id === id ? 'border-brand bg-brand text-white' : 'border-slate-300 bg-white text-brand hover:bg-slate-50'}`}>
                  {r.role.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <Tabs key={id} label={`${d.role.name}: demand, skills and employers`} tabs={tabs} />

      {watchItems.length > 0 && (
        <section aria-labelledby="watch-title" className="space-y-4">
          <h2 id="watch-title" className="text-2xl font-semibold text-brand">What to watch</h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {watchItems.map((insight) => <li key={insight.id}><Interpretation insight={insight} /></li>)}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <FreshnessFooter fetchedAt={d.source.fetchedAt} />
        <SourceInfo source={d.source} />
      </div>
    </div>
  );
}

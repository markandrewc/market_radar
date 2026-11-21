import { Link, useParams } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { ApiError, useDemand, useEmployers, useSkills } from '../api';
import { usePageTitle } from '../hooks';
import { DemandBlock } from '@/components/DemandBlock';
import { SkillsBlock } from '@/components/SkillsBlock';
import { EmployersBlock } from '@/components/EmployersBlock';
import { FreshnessFooter } from '@/components/FreshnessFooter';
import { Tabs, type TabDef } from '@/components/ui/tabs';
import { Empty, ErrorMsg, Loading } from '@/components/Status';

export default function RolePage() {
  const { id = '' } = useParams();
  const demand = useDemand(36);
  const skills = useSkills(id);
  const employers = useEmployers(id);
  const d = demand.data?.find((x) => x.role.id === id);
  usePageTitle(d ? d.role.name : 'Role');

  if (demand.isLoading) return <Loading />;
  if (demand.error) return <ErrorMsg onRetry={() => demand.refetch()} />;
  if (!d) return <div className="space-y-4"><Empty text="We have no data for this role yet."><Link to="/" className="font-medium text-brand-accent underline">Back to all roles</Link></Empty></div>;

  const tabs: TabDef[] = [
    { id: 'demand', label: 'Demand', content: <DemandBlock data={d} /> },
    {
      id: 'skills', label: 'Skills',
      content: skills.isLoading ? <Loading />
        : skills.error ? (skills.error instanceof ApiError && skills.error.status === 404 ? <Empty text="We have no skill data for this role yet." /> : <ErrorMsg onRetry={() => skills.refetch()} />)
        : skills.data ? <SkillsBlock data={skills.data} /> : null,
    },
  ];
  if (employers.data) tabs.push({ id: 'employers', label: 'Employers', content: <EmployersBlock data={employers.data} /> });

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
      <FreshnessFooter fetchedAt={d.source.fetchedAt} />
    </div>
  );
}

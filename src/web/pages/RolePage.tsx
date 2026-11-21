import { Link, useParams } from 'react-router-dom';
import { useDemand, useEmployers, useSkills } from '../api';
import { DemandBlock } from '@/components/DemandBlock';
import { SkillsBlock } from '@/components/SkillsBlock';
import { EmployersBlock } from '@/components/EmployersBlock';
import { FreshnessFooter } from '@/components/FreshnessFooter';
import { Empty, ErrorMsg, Loading } from '@/components/Status';

export default function RolePage() {
  const { id = '' } = useParams();
  const demand = useDemand();
  const skills = useSkills(id);
  const employers = useEmployers(id);

  if (demand.isLoading || skills.isLoading || employers.isLoading) return <Loading />;
  if (demand.error || skills.error || employers.error) return <ErrorMsg />;
  const d = demand.data?.find((x) => x.role.id === id);
  if (!d || !skills.data || !employers.data) return <Empty text="We have no data for this role yet." />;

  return (
    <div className="space-y-6">
      <Link to="/" className="text-sm text-brand-accent">← All roles</Link>
      <h2 className="text-2xl font-semibold text-brand">{d.role.name}</h2>
      <DemandBlock data={d} />
      <div className="grid gap-4 lg:grid-cols-2">
        <SkillsBlock data={skills.data} />
        <EmployersBlock data={employers.data} />
      </div>
      <FreshnessFooter fetchedAt={d.source.fetchedAt} />
    </div>
  );
}

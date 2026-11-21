import { Link, useParams } from 'react-router-dom';
import { useDemand, useEmployers, useSkills } from '../api';
import { DemandBlock } from '@/components/DemandBlock';
import { SkillsBlock } from '@/components/SkillsBlock';
import { EmployersBlock } from '@/components/EmployersBlock';
import { FreshnessFooter } from '@/components/FreshnessFooter';
import { Empty, ErrorMsg, Loading } from '@/components/Status';

export default function RolePage() {
  // One role id drives both the skills table and the employers card.
  const { id = '' } = useParams<{ id: string }>();
  const demand = useDemand();
  const skills = useSkills(id);
  const employers = useEmployers(id);

  if (demand.isLoading || skills.isLoading || employers.isLoading) return <Loading />;
  if (demand.error || skills.error || employers.error) return <ErrorMsg />;

  const row = demand.data?.find((entry) => entry.role.id === id);
  const role = row?.role ?? skills.data?.role ?? employers.data?.role;
  if (!role || !skills.data || !employers.data) {
    return (
      <div className="space-y-4">
        <Link to="/" className="text-sm text-brand-accent">← All roles</Link>
        <Empty text="We have no data for this role yet. Sync the sources in the Sources panel, then check again." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link to="/" className="text-sm text-brand-accent">← All roles</Link>
      <h2 className="text-2xl font-semibold text-brand">{role.name}</h2>
      {row && <DemandBlock data={row} />}
      <div className="grid gap-4 lg:grid-cols-2">
        <SkillsBlock data={skills.data} />
        {/* An empty employers list renders its own "configure Adzuna" state. */}
        <EmployersBlock data={employers.data} />
      </div>
      <FreshnessFooter fetchedAt={row?.source.fetchedAt ?? employers.data.source.fetchedAt} />
    </div>
  );
}

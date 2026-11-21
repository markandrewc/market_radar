import { usePolicy } from '../api';
import { PolicyCard } from '@/components/PolicyCard';
import { Empty, ErrorMsg, Loading } from '@/components/Status';

export default function Policy() {
  const { data, isLoading, error } = usePolicy();
  if (isLoading) return <Loading />;
  if (error) return <ErrorMsg />;
  if (!data?.items.length) return <Empty text="No policy news right now." />;
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold text-brand">Policy news</h2>
      <div className="grid gap-4 md:grid-cols-2">{data.items.map((i) => <PolicyCard key={i.title} item={i} />)}</div>
    </div>
  );
}

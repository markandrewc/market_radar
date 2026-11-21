import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Search } from 'lucide-react';
import { useDemand } from '../api';
import { usePaged } from '../hooks';
import { PageHeader } from '@/components/PageHeader';
import { RoleCard } from '@/components/RoleCard';
import { Segmented } from '@/components/ui/segmented';
import { Pagination } from '@/components/ui/pagination';
import { Empty, ErrorMsg, Loading } from '@/components/Status';

const PAGE = 9;
type Sort = 'open' | 'name';

export default function RolesList() {
  const { data, isLoading, error, refetch } = useDemand();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('open');

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (data ?? []).filter((d) => d.role.name.toLowerCase().includes(q));
    return list.sort((a, b) => (sort === 'name' ? a.role.name.localeCompare(b.role.name) : b.current - a.current));
  }, [data, query, sort]);
  const paged = usePaged(shown, PAGE);

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-1 text-sm text-slate-600">
          <li><Link to="/" className="text-brand-accent underline underline-offset-4">Job market</Link></li>
          <li aria-hidden><ChevronRight className="h-4 w-4" /></li>
          <li aria-current="page">All roles</li>
        </ol>
      </nav>
      <PageHeader title="All roles" description="Every role we have data for. Search by name, sort the list and click a role to see its trend, skills and employers." />
      {isLoading && <Loading />}
      {error && <ErrorMsg onRetry={() => refetch()} />}
      {data && data.length === 0 && <Empty text="There is no data yet. The first update has not run. Please check back later." />}
      {data && data.length > 0 && (
        <>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="w-full max-w-sm space-y-1.5">
              <label htmlFor="role-search" className="block text-sm font-medium text-brand">Search roles</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden />
                <input id="role-search" type="search" value={query} onChange={(e) => { setQuery(e.target.value); paged.setPage(1); }} placeholder="For example: developer"
                  className="w-full rounded-md border border-slate-400 py-2 pl-9 pr-3 text-base" />
              </div>
            </div>
            <div className="space-y-1.5">
              <span className="block text-sm font-medium text-brand" aria-hidden>Sort by</span>
              <Segmented label="Sort by" value={sort} onChange={(v) => { setSort(v); paged.setPage(1); }}
                options={[{ value: 'open', label: 'Most open positions' }, { value: 'name', label: 'Name A–Z' }]} />
            </div>
          </div>
          <p className="text-sm text-slate-600" role="status" aria-live="polite">
            {shown.length === data.length ? `${data.length} roles` : `${shown.length} of ${data.length} roles match “${query}”`}
          </p>
          {shown.length === 0 ? <Empty text="No role matches your search. Try a shorter word." /> : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Roles">
              {paged.slice.map((d) => <li key={`${d.role.id}-${d.source.id}`}><RoleCard d={d} /></li>)}
            </ul>
          )}
          <Pagination label="Roles pages" page={paged.page} pageCount={paged.pageCount} total={paged.total} size={PAGE} onChange={paged.setPage} />
        </>
      )}
    </div>
  );
}

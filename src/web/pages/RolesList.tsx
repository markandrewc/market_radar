import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
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
    <div className="space-y-8">
      <PageHeader
        kicker="ALL ROLES"
        title="All roles"
        description="Every role we have data for. Search by name, sort the list and click a role to see its trend, skills and employers."
      />

      {isLoading && <Loading />}
      {error && <ErrorMsg onRetry={() => refetch()} />}
      {data && data.length === 0 && (
        <Empty text="There is no data yet. The first update has not run. Please check back later." />
      )}

      {data && data.length > 0 && (
        <>
          <div className="rounded-card border border-line bg-surface p-4 shadow-card">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="w-full max-w-sm space-y-1.5">
                <label htmlFor="role-search" className="block text-sm font-medium text-ink">
                  Search roles
                </label>
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft"
                    aria-hidden
                  />
                  <input
                    id="role-search"
                    type="search"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      paged.setPage(1);
                    }}
                    placeholder="For example: developer"
                    className="w-full rounded-control border border-line bg-paper/60 py-2 pl-9 pr-3 text-base text-ink placeholder:text-ink-soft/70 transition-colors hover:border-line-strong focus:border-line-strong focus:bg-surface"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <span className="block text-sm font-medium text-ink" aria-hidden>
                  Sort by
                </span>
                <Segmented
                  label="Sort by"
                  value={sort}
                  onChange={(v) => {
                    setSort(v);
                    paged.setPage(1);
                  }}
                  options={[
                    { value: 'open', label: 'Most open positions' },
                    { value: 'name', label: 'Name A–Z' },
                  ]}
                />
              </div>
            </div>
            <p className="mt-4 border-t border-line pt-3 text-sm text-ink-soft tnum" role="status" aria-live="polite">
              {shown.length === data.length ? `${data.length} roles` : `${shown.length} of ${data.length} roles match “${query}”`}
            </p>
          </div>

          {shown.length === 0 ? (
            <Empty text="No role matches your search. Try a shorter word." />
          ) : (
            <>
              <h2 className="sr-only">Roles</h2>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Roles">
              {paged.slice.map((d) => (
                <li key={`${d.role.id}-${d.source.id}`}>
                  <RoleCard d={d} />
                </li>
                ))}
              </ul>
            </>
          )}

          <Pagination
            label="Roles pages"
            page={paged.page}
            pageCount={paged.pageCount}
            total={paged.total}
            size={PAGE}
            onChange={paged.setPage}
          />
        </>
      )}
    </div>
  );
}

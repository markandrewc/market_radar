import { usePolicy } from '../api';
import { usePaged } from '../hooks';
import { PolicyCard } from '@/components/PolicyCard';
import { PageHeader } from '@/components/PageHeader';
import { Carousel } from '@/components/ui/carousel';
import { Pagination } from '@/components/ui/pagination';
import { Empty, ErrorMsg, Loading } from '@/components/Status';

const PAGE = 4;

export default function Policy() {
  const { data, isLoading, error, refetch } = usePolicy();
  const items = data?.items ?? [];
  const paged = usePaged(items, PAGE);

  return (
    <div className="space-y-8">
      <PageHeader title="Policy news" description="Changes in laws, rules and the labor market that may affect our programme and our participants, newest first." />
      {isLoading && <Loading />}
      {error && <ErrorMsg onRetry={() => refetch()} />}
      {data && items.length === 0 && <Empty text="No policy news right now." />}
      {items.length > 0 && (
        <>
          {/* <section aria-labelledby="latest-title" className="space-y-3">
            <h2 id="latest-title" className="text-xl font-semibold text-brand">Latest</h2>
            <Carousel label="Latest policy news">{items.slice(0, 3).map((i) => <PolicyCard key={i.title} item={i} />)}</Carousel>
          </section> */}
          <section aria-labelledby="all-title" className="space-y-3">
            <h2 id="all-title" className="text-xl font-semibold text-brand">All updates</h2>
            <ul className="grid gap-4 md:grid-cols-2">{paged.slice.map((i) => <li key={i.title}><PolicyCard item={i} /></li>)}</ul>
            <Pagination label="Policy news pages" page={paged.page} pageCount={paged.pageCount} total={paged.total} size={PAGE} onChange={paged.setPage} />
          </section>
        </>
      )}
    </div>
  );
}

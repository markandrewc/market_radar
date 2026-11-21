import { Link } from 'react-router-dom';
import { ArrowRight, FileText, Landmark, LineChart, MousePointerClick, ShieldCheck } from 'lucide-react';
import { useDemand } from '../api';
import { usePageTitle } from '../hooks';
import { Button } from '@/components/ui/button';
import { RoleCard } from '@/components/RoleCard';
import { FreshnessFooter } from '@/components/FreshnessFooter';
import { Glossary } from '@/components/Glossary';
import { Empty, ErrorMsg, Loading } from '@/components/Status';

const TOP = 3;

const steps = [
  { icon: MousePointerClick, title: '1. Pick a role', text: 'Choose the role below that your graduates go into.' },
  { icon: LineChart, title: '2. Read the trend', text: 'See how many jobs are open and which skills employers ask for.' },
  { icon: ShieldCheck, title: '3. Check the source', text: 'Every number shows where it comes from and when it was updated.' },
];

const next = [
  { to: '/policy', icon: Landmark, title: 'Policy news', text: 'Changes in rules that may affect our participants.' },
  { to: '/reports', icon: FileText, title: 'Weekly reports', text: 'Get a short summary by email.' },
  { to: '/sources', icon: ShieldCheck, title: 'Data sources', text: 'See every source and how current it is.' },
];

export default function Home({ onHelp }: { onHelp: () => void }) {
  usePageTitle('Job market');
  const { data, isLoading, error, refetch } = useDemand();
  const latest = data?.map((d) => d.source.fetchedAt).sort().at(-1);
  const top = data ? [...data].sort((a, b) => b.current - a.current).slice(0, TOP) : [];

  return (
    <div className="space-y-10">
      <section className="rounded-2xl bg-brand px-6 py-10 text-white">
        <p className="text-sm font-medium uppercase tracking-widest text-rose-200">Market Radar</p>
        <h1 className="mt-2 max-w-2xl text-3xl font-bold sm:text-4xl">See which IT skills Swiss employers are looking for.</h1>
        <p className="mt-3 max-w-2xl text-slate-200">How many jobs are open for the roles our graduates go into, which skills are asked for, and how that changed over the months.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a href="#roles" className="inline-flex min-h-10 items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-brand hover:bg-slate-100">Start with a role <ArrowRight className="h-4 w-4" aria-hidden /></a>
          <Button variant="outline" onClick={onHelp} className="border-white/60 bg-transparent text-white hover:bg-white/10">Take a quick tour</Button>
        </div>
      </section>

      <section aria-labelledby="how-title" className="space-y-4">
        <h2 id="how-title" className="text-xl font-semibold text-brand">How it works</h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {steps.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-4">
              <Icon className="mt-0.5 h-6 w-6 shrink-0 text-brand-accent" aria-hidden />
              <div><h3 className="font-semibold text-brand">{title}</h3><p className="text-sm text-slate-700">{text}</p></div>
            </li>
          ))}
        </ol>
      </section>

      <section id="roles" aria-labelledby="roles-title" className="scroll-mt-6 space-y-4">
        <div>
          <h2 id="roles-title" className="text-2xl font-semibold text-brand">Job market by role</h2>
          <p className="text-slate-700">The roles with the most open positions right now. Click a role name to see its trend, skills and employers.</p>
        </div>
        {isLoading && <Loading />}
        {error && <ErrorMsg onRetry={() => refetch()} />}
        {data && data.length === 0 && <Empty text="There is no data yet. The first update has not run. Please check back later." />}
        {top.length > 0 && (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {top.map((d) => <li key={`${d.role.id}-${d.source.id}`}><RoleCard d={d} /></li>)}
          </ul>
        )}
        {data && data.length > TOP && (
          <p>
            <Link to="/roles" className="inline-flex min-h-10 items-center gap-2 rounded-md bg-brand-accent px-5 py-2 text-sm font-medium text-white hover:bg-[#8f2943]">
              Show all {data.length} roles <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </p>
        )}
        {latest && <FreshnessFooter fetchedAt={latest} />}
      </section>

      <section aria-labelledby="next-title" className="space-y-4">
        <h2 id="next-title" className="text-xl font-semibold text-brand">Where to go next</h2>
        <ul className="grid gap-4 sm:grid-cols-3">
          {next.map(({ to, icon: Icon, title, text }) => (
            <li key={to}>
              <Link to={to} className="flex h-full gap-3 rounded-xl border border-slate-200 bg-white p-4 hover:border-brand-accent hover:bg-brand-soft">
                <Icon className="mt-0.5 h-6 w-6 shrink-0 text-brand-accent" aria-hidden />
                <span><span className="block font-semibold text-brand">{title}</span><span className="text-sm text-slate-700">{text}</span></span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <Glossary />
    </div>
  );
}

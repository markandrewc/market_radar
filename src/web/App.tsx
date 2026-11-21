import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { CircleHelp, Info, Menu, X } from 'lucide-react';
import Home from './pages/Home';
import RolePage from './pages/RolePage';
import RolesList from './pages/RolesList';
import Reports from './pages/Reports';
import Policy from './pages/Policy';
import Participants from './pages/Participants';
import Sources from './pages/Sources';
import Items from './pages/Items';
import Ask from './pages/Ask';
import { Logo } from './components/Logo';
import { HelpDialog } from './components/HelpDialog';
import { Button } from './components/ui/button';
import { useDemand, useMocks } from './api';
import { useLocalFlag } from './hooks';
import { cn } from '@/lib/utils';

const nav = [
  { label: 'Job market', to: '/' },
  { label: 'Ask', to: '/ask' },
  { label: 'Participants', to: '/participants' },
  { label: 'Policy', to: '/policy' },
  { label: 'Reports', to: '/reports' },
  { label: 'Items', to: '/items' },
  { label: 'Sources', to: '/sources' },
];

/** Nav pills: ink on paper, one quiet crimson dot for the current page. */
const navLinkClass = (isActive: boolean) =>
  cn(
    'inline-flex w-full items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-colors sm:w-auto',
    isActive ? 'bg-brand-soft text-ink' : 'text-ink-soft hover:bg-brand-soft/60 hover:text-ink',
  );

/** Ask is the only filled crimson action in the header. */
const askLinkClass = (isActive: boolean) =>
  cn(
    'inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-brand-accent px-3.5 py-2 text-sm font-semibold text-white transition-colors sm:w-auto',
    'hover:bg-accent-deep',
    isActive && 'ring-2 ring-accent-soft ring-offset-2 ring-offset-paper',
  );

export default function App() {
  const demand = useDemand();
  const { pathname } = useLocation();
  const main = useRef<HTMLElement>(null);
  const first = useRef(true);
  const [menu, setMenu] = useState(false);
  const [help, setHelp] = useState(false);
  const [seen, setSeen] = useLocalFlag('mr-tour-seen');

  // Banner while sample or estimated numbers are on screen, so nobody mistakes them for exact counts.
  const isSample = useMocks || Boolean(demand.data?.some((d) => d.source.id === 'sample'));
  const isEstimate = Boolean(demand.data?.some((d) => d.source.name.startsWith('Estimate')));
  const banner = isSample ? 'Demo data: these numbers are samples, not real' : isEstimate ? 'Estimated figures based on public 2026 reports, not exact counts. See the source under each number.' : null;

  // First visit: offer the guided tour once.
  useEffect(() => { if (!seen) { setHelp(true); setSeen(true); } }, [seen, setSeen]);

  // After moving to another page, send focus to the content (keyboard and screen-reader users) and close the menu.
  useEffect(() => {
    setMenu(false);
    if (first.current) { first.current = false; return; }
    main.current?.focus();
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <a href="#main" onClick={(e) => { e.preventDefault(); main.current?.focus(); }}
        className="sr-only z-50 rounded-control bg-surface px-4 py-2 font-medium text-ink shadow-float focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Skip to the main content
      </a>

      {/* Slim provenance strip: the page explains sample or estimated numbers before anything else. */}
      {banner && (
        <aside aria-label="Data notice" className="flex items-center justify-center gap-2 bg-brand-accent px-4 py-1.5 text-center text-xs font-medium text-white">
          <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{banner}</span>
        </aside>
      )}

      <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between gap-3 px-4 sm:px-6">
          <Link to="/" aria-label="Market Radar, home" className="flex shrink-0 items-center">
            <Logo className="h-7 w-auto" />
          </Link>
          <nav aria-label="Main" className="flex items-center gap-2">
            <ul
              id="main-menu"
              className={cn(
                'flex-col gap-1 border-b border-line bg-surface p-4 shadow-lift',
                'sm:static sm:flex sm:flex-row sm:items-center sm:gap-1 sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none',
                menu ? 'absolute inset-x-0 top-full z-40 flex' : 'hidden sm:flex',
              )}
            >
              {nav.map((n) => {
                const isAsk = n.to === '/ask';
                return (
                  <li key={n.to}>
                    <NavLink to={n.to} end={n.to === '/'} className={({ isActive }) => (isAsk ? askLinkClass(isActive) : navLinkClass(isActive))}>
                      {({ isActive }) => (
                        <>
                          {n.label}
                          {!isAsk && isActive && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-brand-accent" />}
                        </>
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHelp(true)}
              className="rounded-full border-line bg-surface text-ink hover:border-line-strong hover:bg-brand-soft"
            >
              <CircleHelp className="h-4 w-4" aria-hidden />How to use
            </Button>
            <Button variant="ghost" size="sm" className="rounded-full text-ink hover:bg-brand-soft sm:hidden" aria-expanded={menu} aria-controls="main-menu" aria-label={menu ? 'Close the menu' : 'Open the menu'} onClick={() => setMenu(!menu)}>
              {menu ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
            </Button>
          </nav>
        </div>
      </header>

      <main id="main" ref={main} tabIndex={-1} className="mx-auto w-full max-w-[1180px] flex-1 px-4 py-10 outline-none sm:px-6">
        <Routes>
          <Route path="/" element={<Home onHelp={() => setHelp(true)} />} />
          <Route path="/ask" element={<Ask />} />
          <Route path="/roles" element={<RolesList />} />
          <Route path="/roles/:id" element={<RolePage />} />
          <Route path="/participants" element={<Participants />} />
          <Route path="/policy" element={<Policy />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/items" element={<Items />} />
          <Route path="/sources" element={<Sources />} />
          <Route path="*" element={<div className="space-y-3"><h1 className="text-3xl font-semibold tracking-tight text-ink">Page not found</h1><p><Link to="/" className="font-medium text-brand-accent underline decoration-brand-accent/30 underline-offset-4 hover:text-accent-deep">Back to the Job market page</Link></p></div>} />
        </Routes>
      </main>

      <footer className="mt-16 bg-brand text-paper/80">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1.5">
            <p className="flex items-center gap-2 text-sm font-semibold text-paper">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-brand-accent" />
              Powercoders · Market Radar
            </p>
            <p className="text-sm">Every number links to its source</p>
          </div>
          <div className="flex flex-col gap-2 text-sm md:items-end">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <button type="button" onClick={() => setHelp(true)} className="font-medium text-paper underline decoration-paper/40 underline-offset-4 hover:decoration-paper focus-visible:outline-paper">How to use this site</button>
              <Link to="/sources" className="font-medium text-paper underline decoration-paper/40 underline-offset-4 hover:decoration-paper focus-visible:outline-paper">Where the data comes from</Link>
            </div>
            <p className="text-xs text-paper/60">© {new Date().getFullYear()} Powercoders</p>
          </div>
        </div>
      </footer>
      <HelpDialog open={help} onClose={() => setHelp(false)} />
    </div>
  );
}

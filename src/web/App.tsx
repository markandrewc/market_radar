import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { CircleHelp, Menu, X } from 'lucide-react';
import Home from './pages/Home';
import RolePage from './pages/RolePage';
import RolesList from './pages/RolesList';
import Reports from './pages/Reports';
import Policy from './pages/Policy';
import Sources from './pages/Sources';
import { Logo } from './components/Logo';
import { HelpDialog } from './components/HelpDialog';
import { Button } from './components/ui/button';
import { useDemand, useMocks } from './api';
import { useLocalFlag } from './hooks';

const nav = [
  { label: 'Job market', to: '/' },
  { label: 'Policy', to: '/policy' },
  { label: 'Reports', to: '/reports' },
  { label: 'Sources', to: '/sources' },
];

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

  const link = ({ isActive }: { isActive: boolean }) =>
    `block rounded-md px-3 py-2 text-sm font-medium hover:text-brand-accent ${isActive ? 'bg-brand-soft text-brand-accent underline underline-offset-8' : 'text-brand'}`;

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      <a href="#main" onClick={(e) => { e.preventDefault(); main.current?.focus(); }}
        className="sr-only z-50 rounded-md bg-white px-4 py-2 font-medium text-brand focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:shadow-lg">
        Skip to the main content
      </a>
      <header className="border-b border-slate-200 bg-white">
        {banner && <p className="bg-brand-accent px-4 py-1.5 text-center text-xs font-medium text-white">{banner}</p>}
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" aria-label="Market Radar, home"><Logo /></Link>
          <nav aria-label="Main" className="flex items-center gap-2">
            <ul id="main-menu" className={`${menu ? 'absolute left-0 right-0 top-full z-40 flex flex-col gap-1 border-b border-slate-200 bg-white p-3 shadow-md' : 'hidden'} sm:static sm:flex sm:flex-row sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none`}>
              {nav.map((n) => <li key={n.to}><NavLink to={n.to} end={n.to === '/'} className={link}>{n.label}</NavLink></li>)}
            </ul>
            <Button variant="outline" size="sm" onClick={() => setHelp(true)}><CircleHelp className="h-4 w-4" aria-hidden />How to use</Button>
            <Button variant="ghost" size="sm" className="sm:hidden" aria-expanded={menu} aria-controls="main-menu" aria-label={menu ? 'Close the menu' : 'Open the menu'} onClick={() => setMenu(!menu)}>
              {menu ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
            </Button>
          </nav>
        </div>
      </header>
      <main id="main" ref={main} tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 outline-none">
        <Routes>
          <Route path="/" element={<Home onHelp={() => setHelp(true)} />} />
          <Route path="/roles" element={<RolesList />} />
          <Route path="/roles/:id" element={<RolePage />} />
          <Route path="/policy" element={<Policy />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/sources" element={<Sources />} />
          <Route path="*" element={<div className="space-y-3"><h1 className="text-3xl font-semibold text-brand">Page not found</h1><p><Link to="/" className="text-brand-accent underline">Back to the Job market page</Link></p></div>} />
        </Routes>
      </main>
      <footer className="bg-brand-soft py-6 text-sm text-slate-700">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4">
          <p>Powercoders · Market Radar</p>
          <p><button type="button" onClick={() => setHelp(true)} className="font-medium text-brand underline underline-offset-4">How to use this site</button> · <Link to="/sources" className="font-medium text-brand underline underline-offset-4">Where the data comes from</Link></p>
        </div>
      </footer>
      <HelpDialog open={help} onClose={() => setHelp(false)} />
    </div>
  );
}

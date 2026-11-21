import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { ArrowRight, CircleHelp, Info, Menu, X } from 'lucide-react';
import Home from './pages/Home';
import RolePage from './pages/RolePage';
import RolesList from './pages/RolesList';
import Context from './pages/Context';
import Reports from './pages/Reports';
import Policy from './pages/Policy';
import Participants from './pages/Participants';
import Sources from './pages/Sources';
import Items from './pages/Items';
import Ask from './pages/Ask';
import { Logo } from './components/Logo';
import { LevelTabs } from './components/LevelTabs';
import { HelpDialog } from './components/HelpDialog';
import { Button } from './components/ui/button';
import { formatDate } from './components/SourceInfo';
import { useDemand, useMocks, useSources } from './api';
import { TourProvider, markTourOffered, shouldOfferTour, useTour } from './tour/TourContext';
import { TourOverlay } from './tour/TourOverlay';
import { cn } from '@/lib/utils';

const DAY_MS = 86_400_000;

/** One quiet link style for the utility nav inside the level row. */
const utilityLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'inline-flex items-center justify-center gap-1.5 rounded-control px-3 py-2 text-sm font-medium transition-colors',
    isActive ? 'bg-brand-soft text-ink' : 'text-ink-soft hover:bg-brand-soft/60 hover:text-ink',
  );

const footerLinkClass =
  'font-medium text-paper underline decoration-paper/40 underline-offset-4 hover:decoration-paper focus-visible:outline-paper';

/**
 * The sync chip answers "how old is the data?" before anyone reads a number.
 * The newest fetch across all feeds drives the date; the tone dot only repeats
 * what the text says, so the meaning never depends on colour.
 */
function SyncChip() {
  const sources = useSources();
  const newest = (sources.data ?? []).reduce<string | null>((best, source) => {
    if (!source.lastFetchedAt || Number.isNaN(Date.parse(source.lastFetchedAt))) return best;
    if (!best) return source.lastFetchedAt;
    return Date.parse(source.lastFetchedAt) > Date.parse(best) ? source.lastFetchedAt : best;
  }, null);
  const fresh = newest ? Date.now() - Date.parse(newest) < 8 * DAY_MS : false;
  const tone = sources.isPending || !newest ? 'unknown' : fresh ? 'fresh' : 'stale';

  return (
    <Link
      to="/sources"
      data-tour="sync"
      className="hidden min-h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] font-medium text-ink-soft transition-colors hover:border-line-strong hover:text-ink sm:inline-flex"
    >
      <span
        aria-hidden
        className={cn(
          'h-1.5 w-1.5 shrink-0 rounded-full',
          tone === 'fresh' ? 'bg-emerald-600' : tone === 'stale' ? 'bg-amber-500' : 'bg-line-strong',
        )}
      />
      {sources.isPending ? (
        'Checking data…'
      ) : sources.isError ? (
        'Sync status unavailable'
      ) : !newest ? (
        'No sync yet'
      ) : (
        <span>
          Data updated {formatDate(newest)}
          {!fresh && ' · out of date'}
          <span className="sr-only">{fresh ? ', within the last week' : ', older than a week'}</span>
        </span>
      )}
    </Link>
  );
}

function AppShell() {
  const demand = useDemand();
  const { pathname } = useLocation();
  const main = useRef<HTMLElement>(null);
  const first = useRef(true);
  const [menu, setMenu] = useState(false);
  const [help, setHelp] = useState(false);
  const tour = useTour();
  // Opening the tour from the mobile sheet closes the sheet first.
  const openHelp = () => { setMenu(false); setHelp(true); };
  const startTour = (mode: 'quick' | 'full') => { setHelp(false); setMenu(false); tour.start(mode); };

  // Banner while sample or estimated numbers are on screen, so nobody mistakes them for exact counts.
  const isSample = useMocks || Boolean(demand.data?.some((d) => d.source.id === 'sample'));
  const isEstimate = Boolean(demand.data?.some((d) => d.source.name.startsWith('Estimate')));
  const banner = isSample ? 'Demo data: these numbers are samples, not real' : isEstimate ? 'Estimated figures based on public 2026 reports, not exact counts. See the source under each number.' : null;

  // First visit: offer the tour once per tour version (not as an intrusive overlay).
  useEffect(() => {
    if (shouldOfferTour()) {
      setHelp(true);
      markTourOffered();
    }
  }, []);

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
        {/* Row 1: brand, orientation chip, sync status, the one filled action (Ask) and the levels toggle. */}
        <div className="mx-auto flex h-16 max-w-[1180px] items-center gap-3 px-4 sm:px-6">
          <Link to="/" aria-label="Market Radar, home" className="flex shrink-0 items-center">
            <Logo className="h-7 w-auto" />
          </Link>
          <span className="hidden rounded-full bg-brand-soft px-2 py-0.5 text-[11px] text-ink-soft sm:inline-flex">
            Swiss NGO decision support
          </span>
          <SyncChip />
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={openHelp}
              className="max-sm:hidden rounded-control border-line bg-surface text-ink hover:border-line-strong hover:bg-brand-soft"
            >
              <CircleHelp className="h-4 w-4" aria-hidden />How to use
            </Button>
            <NavLink
              to="/ask"
              data-tour="ask"
              className={({ isActive }) =>
                cn(
                  'inline-flex items-center gap-1.5 rounded-control bg-brand-accent px-3.5 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-accent-deep',
                  isActive && 'ring-2 ring-accent-soft ring-offset-2 ring-offset-paper',
                )
              }
            >
              Ask
              <ArrowRight className="h-4 w-4" aria-hidden />
            </NavLink>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-control text-ink hover:bg-brand-soft sm:hidden"
              aria-expanded={menu}
              aria-controls="main-menu"
              aria-label={menu ? 'Close the menu' : 'Open the menu'}
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
            </Button>
          </div>
        </div>

        {/* Row 2: the four levels; on small screens the same block becomes the menu sheet. */}
        <div
          id="main-menu"
          className={cn(
            'sm:static sm:z-auto sm:block sm:border-t sm:border-line sm:bg-transparent sm:p-0 sm:shadow-none',
            menu
              ? 'absolute inset-x-0 top-full z-30 border-b border-line bg-surface p-4 shadow-lift'
              : 'hidden',
          )}
        >
          <div className="mx-auto flex max-w-[1180px] flex-col gap-2 px-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 sm:py-1.5">
            <div data-tour="levels" className="min-w-0 flex-1"><LevelTabs /></div>
            <nav
              aria-label="Main"
              className="flex flex-col gap-1 border-t border-line pt-3 sm:flex-row sm:items-center sm:gap-1 sm:border-0 sm:pt-0"
            >
              <NavLink to="/items" className={utilityLinkClass}>
                Items
              </NavLink>
              <Button
                variant="ghost"
                size="sm"
                onClick={openHelp}
                data-tour="tour-button"
                className="justify-start rounded-control sm:justify-center"
              >
                Tour
              </Button>
              {menu && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openHelp}
                  className="justify-start rounded-control border-line bg-surface text-ink hover:border-line-strong hover:bg-brand-soft sm:hidden"
                >
                  <CircleHelp className="h-4 w-4" aria-hidden />How to use
                </Button>
              )}
            </nav>
          </div>
        </div>
      </header>

      <main id="main" ref={main} tabIndex={-1} className="mx-auto w-full max-w-[1180px] flex-1 scroll-mt-28 px-4 py-10 outline-none sm:px-6">
        <Routes>
          <Route path="/" element={<Home onHelp={() => setHelp(true)} />} />
          <Route path="/ask" element={<Ask />} />
          <Route path="/roles" element={<RolesList />} />
          <Route path="/roles/:id" element={<RolePage />} />
          <Route path="/context" element={<Context />} />
          <Route path="/participants" element={<Participants />} />
          <Route path="/policy" element={<Policy />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/items" element={<Items />} />
          <Route path="/sources" element={<Sources />} />
          <Route path="*" element={<div className="space-y-3"><h1 className="text-3xl font-semibold tracking-tight text-ink">Page not found</h1><p><Link to="/" className="font-medium text-brand-accent underline decoration-brand-accent/30 underline-offset-4 hover:text-accent-deep">Back to the Job market page</Link></p></div>} />
        </Routes>
      </main>

      <footer className="mt-16 border-t border-white/10 bg-brand text-paper/80">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-8 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm space-y-2">
            <p className="flex items-center gap-2 text-sm font-semibold text-paper">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-brand-accent" />
              Powercoders · Market Radar
            </p>
            <p className="text-sm">Every number links to its source</p>
            <p className="text-xs text-paper/60">Swiss NGO decision support · © {new Date().getFullYear()} Powercoders</p>
          </div>
          <nav aria-label="Footer" className="w-full max-w-xs md:max-w-sm">
            <ul className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              <li><Link to="/" className={footerLinkClass}>Levels</Link></li>
              <li><Link to="/sources" className={footerLinkClass}>Data sources</Link></li>
              <li><Link to="/items" className={footerLinkClass}>Records</Link></li>
              <li><button type="button" onClick={openHelp} className={cn(footerLinkClass, 'text-left')}>How to use this site</button></li>
            </ul>
          </nav>
        </div>
      </footer>
      <HelpDialog
        open={help}
        onClose={() => setHelp(false)}
        onStartQuick={() => startTour('quick')}
        onStartFull={() => startTour('full')}
      />
    </div>
  );
}

export default function App() {
  return (
    <TourProvider>
      <AppShell />
      <TourOverlay />
    </TourProvider>
  );
}

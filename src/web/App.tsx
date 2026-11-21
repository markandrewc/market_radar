import { Link, Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import RolePage from './pages/RolePage';
import Reports from './pages/Reports';
import Policy from './pages/Policy';
import Participants from './pages/Participants';
import Sources from './pages/Sources';
import { Logo } from './components/Logo';

const nav = [
  { label: 'Market', to: '/' },
  { label: 'Participants', to: '/participants' },
  { label: 'Policy', to: '/policy' },
  { label: 'Reports', to: '/reports' },
  { label: 'Sources', to: '/sources' },
];

export default function App() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      {import.meta.env.VITE_USE_MOCKS !== '0' && (
        <div className="bg-brand-accent px-4 py-1 text-center text-xs font-medium text-white">Demo data</div>
      )}
      <header className="border-b border-slate-200 bg-white">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link to="/"><Logo /></Link>
          <ul className="hidden gap-8 text-sm font-medium text-brand sm:flex">
            {nav.map((n) => <li key={n.to}><Link to={n.to} className="hover:text-brand-accent">{n.label}</Link></li>)}
          </ul>
        </nav>
      </header>
      <section className="bg-brand text-white">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <p className="text-sm uppercase tracking-widest text-brand-accent">Market Radar</p>
          <h1 className="mt-2 max-w-2xl text-3xl font-bold sm:text-4xl">See which IT skills Swiss employers are looking for.</h1>
        </div>
      </section>
      <main className="mx-auto max-w-6xl bg-white px-4 py-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/roles/:id" element={<RolePage />} />
          <Route path="/participants" element={<Participants />} />
          <Route path="/policy" element={<Policy />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/sources" element={<Sources />} />
        </Routes>
      </main>
      <footer className="bg-brand-soft py-6 text-center text-xs text-slate-500">Powercoders · Market Radar</footer>
    </div>
  );
}

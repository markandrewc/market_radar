import { Link, Route, Routes } from 'react-router-dom';
import LanguagePicker from '@/components/LanguagePicker';
import { useLanguage } from '@/i18n';
import Home from './pages/Home';

export default function App() {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <nav aria-label={t('Hauptnavigation', 'Main navigation', 'Navigation principale', 'Navigazione principale', 'Головна навігація', 'التنقل الرئيسي')} className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
          <Link to="/" className="font-semibold">Market Radar</Link>
          <LanguagePicker />
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Routes>
          <Route path="/" element={<Home />} />
        </Routes>
      </main>
    </div>
  );
}

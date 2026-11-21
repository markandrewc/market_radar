import { getRegionalMarket, regionalPeriods, regionalSource, regionOptions, type RegionId } from '@/data/regional-market';
import { useLanguage } from '@/i18n';

export type { RegionId } from '@/data/regional-market';

type RegionalMarketProps = {
  region: RegionId;
  onRegionChange: (region: RegionId) => void;
};

const sourceLink = 'font-semibold text-teal-800 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700';

export default function RegionalMarket({ region, onRegionChange }: RegionalMarketProps) {
  const { t, locale } = useLanguage();
  const { option, observation, jobsUrl } = getRegionalMarket(region);
  const estimates = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const dates = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' });
  const locations: Record<RegionId, string> = {
    switzerland: t('Ganze Schweiz', 'All Switzerland', 'Toute la Suisse', 'Tutta la Svizzera', 'Уся Швейцарія', 'سويسرا كلها'),
    zurich: t('Zürich', 'Zurich', 'Zurich', 'Zurigo', 'Цюрих', 'زيورخ'),
    bern: t('Bern', 'Bern', 'Berne', 'Berna', 'Берн', 'برن'),
    basel: t('Basel', 'Basel', 'Bâle', 'Basilea', 'Базель', 'بازل'),
    geneva: t('Genf', 'Geneva', 'Genève', 'Ginevra', 'Женева', 'جنيف'),
    lausanne: t('Lausanne', 'Lausanne', 'Lausanne', 'Losanna', 'Лозанна', 'لوزان'),
    lucerne: t('Luzern', 'Lucerne', 'Lucerne', 'Lucerna', 'Люцерн', 'لوتسرن'),
  };
  const regionNames = {
    switzerland: t('Schweiz', 'Switzerland', 'Suisse', 'Svizzera', 'Швейцарія', 'سويسرا'),
    zurich: t('Grossregion Zürich', 'Zurich large region', 'Grande région de Zurich', 'Grande regione di Zurigo', 'Великий регіон Цюриха', 'إقليم زيورخ الإحصائي'),
    espaceMittelland: t('Espace Mittelland', 'Espace Mittelland', 'Espace Mittelland', 'Espace Mittelland', 'Еспас-Міттелланд', 'إسباس ميتلاند'),
    northwestern: t('Nordwestschweiz', 'Northwestern Switzerland', 'Suisse du Nord-Ouest', 'Svizzera nordoccidentale', 'Північно-Західна Швейцарія', 'شمال غرب سويسرا'),
    lakeGeneva: t('Genferseeregion', 'Lake Geneva region', 'Région lémanique', 'Regione del Lemano', 'Регіон Женевського озера', 'إقليم بحيرة جنيف'),
    central: t('Zentralschweiz', 'Central Switzerland', 'Suisse centrale', 'Svizzera centrale', 'Центральна Швейцарія', 'وسط سويسرا'),
  };
  const scopes = {
    switzerland: locations.switzerland,
    zurich: t('Kanton Zürich', 'Canton of Zurich', 'Canton de Zurich', 'Cantone di Zurigo', 'Кантон Цюрих', 'كانتون زيورخ'),
    espaceMittelland: t('Kantone Bern, Freiburg, Jura, Neuenburg und Solothurn', 'Bern, Fribourg, Jura, Neuchâtel and Solothurn cantons', 'Cantons de Berne, Fribourg, Jura, Neuchâtel et Soleure', 'Cantoni di Berna, Friburgo, Giura, Neuchâtel e Soletta', 'Кантони Берн, Фрібур, Юра, Невшатель і Золотурн', 'كانتونات برن وفريبورغ وجورا ونوشاتيل وسولوتورن'),
    northwestern: t('Kantone Aargau, Basel-Landschaft und Basel-Stadt', 'Aargau, Basel-Landschaft and Basel-Stadt cantons', 'Cantons d’Argovie, de Bâle-Campagne et de Bâle-Ville', 'Cantoni di Argovia, Basilea Campagna e Basilea Città', 'Кантони Ааргау, Базель-Ланд і Базель-Штадт', 'كانتونات أرغاو وبازل-لاند وبازل-شتات'),
    lakeGeneva: t('Kantone Genf, Waadt und Wallis', 'Geneva, Vaud and Valais cantons', 'Cantons de Genève, Vaud et Valais', 'Cantoni di Ginevra, Vaud e Vallese', 'Кантони Женева, Во та Вале', 'كانتونات جنيف وفو وفاليه'),
    central: t('Kantone Luzern, Nidwalden, Obwalden, Schwyz, Uri und Zug', 'Lucerne, Nidwalden, Obwalden, Schwyz, Uri and Zug cantons', 'Cantons de Lucerne, Nidwald, Obwald, Schwytz, Uri et Zoug', 'Cantoni di Lucerna, Nidvaldo, Obvaldo, Svitto, Uri e Zugo', 'Кантони Люцерн, Нідвальден, Обвальден, Швіц, Урі та Цуг', 'كانتونات لوتسرن ونيدفالدن وأوبفالدن وشفيتس وأوري وتسوغ'),
  };
  const city = locations[option.id];
  const jobsLabel = option.jobLocation
    ? t(`Stellen in ${city} auf jobs.ch suchen`, `Search jobs.ch for ${city}`, `Chercher des offres à ${city} sur jobs.ch`, `Cerca offerte a ${city} su jobs.ch`, `Шукати вакансії в місті ${city} на jobs.ch`, `ابحث عن وظائف في ${city} على jobs.ch`)
    : t('Stellen schweizweit auf jobs.ch suchen', 'Search jobs.ch across Switzerland', 'Chercher des offres dans toute la Suisse sur jobs.ch', 'Cerca offerte in tutta la Svizzera su jobs.ch', 'Шукати вакансії по всій Швейцарії на jobs.ch', 'ابحث عن وظائف في كل سويسرا على jobs.ch');

  function formatQuarter(period: string) {
    const [quarter, , year] = period.split(' ');
    const q = estimates.format(Number.parseInt(quarter, 10));
    const y = new Intl.NumberFormat(locale, { useGrouping: false }).format(Number(year));
    return t(`${q}. Quartal ${y}`, `Q${q} ${y}`, `${q}${q === '1' ? 'er' : 'e'} trimestre ${y}`, `${q}º trimestre ${y}`, `${q}-й квартал ${y}`, `الربع ${q} من ${y}`);
  }

  return (
    <section id="regions" aria-labelledby="regional-market-heading" className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-700 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="regional-market-heading" className="text-base font-semibold text-slate-900">{t('Offene Stellen nach Standort', 'Vacancies by location', 'Offres par lieu', 'Offerte per località', 'Вакансії за місцем роботи', 'الوظائف الشاغرة حسب الموقع')}</h2>
          <p id="regional-market-coverage-note" className="mt-1">{t('Wähle eine Stadt für die Stellensuche. Die BFS-Schätzungen beziehen sich auf die angegebene Grossregion oder auf die ganze Schweiz.', 'Choose a city for the job search. BFS estimates cover the named large region or all of Switzerland.', 'Choisissez une ville pour la recherche. Les estimations de l’OFS couvrent la grande région indiquée ou toute la Suisse.', 'Scegli una città per la ricerca. Le stime dell’UST riguardano la grande regione indicata o tutta la Svizzera.', 'Виберіть місто для пошуку. Оцінки BFS охоплюють зазначений великий регіон або всю Швейцарію.', 'اختر مدينة للبحث عن وظائف. وتشمل تقديرات مكتب الإحصاء BFS الإقليم الإحصائي المذكور أو سويسرا كلها.')}</p>
        </div>
        <label className="flex flex-wrap items-center gap-2 font-medium text-slate-800">
          {t('Standort', 'Location', 'Lieu', 'Località', 'Місце', 'الموقع')}
          <select
            value={region}
            onChange={event => onRegionChange(event.currentTarget.value as RegionId)}
            aria-describedby="regional-market-coverage-note"
            className="min-w-36 rounded-lg border border-slate-300 bg-white px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          >
            {regionOptions.map(item => <option key={item.id} value={item.id}>{locations[item.id]}</option>)}
          </select>
        </label>
      </div>
      <div className="mt-4 rounded-lg border border-teal-100 bg-teal-50/60 p-4" aria-live="polite">
        <h3 className="font-semibold text-slate-900">{regionNames[option.geography]} · {t('geschätzte offene Stellen', 'estimated vacancies', 'postes vacants estimés', 'posti vacanti stimati', 'оцінка кількості вакансій', 'الوظائف الشاغرة المقدّرة')}</h3>
        <p className="mt-1">{scopes[option.geography]} · {t('Industrie, Bau und Dienstleistungen', 'industry, construction and services', 'industrie, construction et services', 'industria, costruzione e servizi', 'промисловість, будівництво та послуги', 'الصناعة والبناء والخدمات')}</p>
        <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {regionalPeriods.map((period, index) => (
            <div key={period} className={`rounded-lg border bg-white px-3 py-2 ${index === regionalPeriods.length - 1 ? 'border-teal-500' : 'border-slate-200'}`}>
              <dt className="text-xs font-semibold text-slate-600">{formatQuarter(period)}</dt>
              <dd className="text-xl font-semibold text-slate-900 tabular-nums">{estimates.format(Math.round(observation.counts[index] * 1000))}</dd>
            </div>
          ))}
        </dl>
      </div>
      <p className="mt-3">
        {t('Quartalsschätzungen, auf 100 Stellen gerundet. Das jüngste gezeigte Quartal endete am', 'Quarterly estimates, rounded to the nearest 100 vacancies. The latest quarter shown ended on', 'Estimations trimestrielles arrondies à 100 postes. Le dernier trimestre affiché s’est terminé le', 'Stime trimestrali arrotondate a 100 posti. L’ultimo trimestre mostrato è terminato il', 'Квартальні оцінки округлено до 100 вакансій. Останній показаний квартал завершився', 'تقديرات ربع سنوية مقرّبة إلى أقرب مئة وظيفة. انتهى آخر ربع معروض في')}{' '}
        <time dateTime="2026-06-30">{dates.format(new Date('2026-06-30'))}</time>.{' '}
        {t('Das BFS veröffentlichte die Tabelle am', 'BFS published the table on', 'L’OFS a publié le tableau le', 'L’UST ha pubblicato la tabella il', 'BFS опублікувало таблицю', 'نشر مكتب الإحصاء الجدول في')}{' '}
        <time dateTime={regionalSource.publicationDate}>{dates.format(new Date(regionalSource.publicationDate))}</time>.
      </p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
        <a href={regionalSource.pageUrl} target="_blank" rel="noopener noreferrer" className={sourceLink}>{t('BFS-Beschäftigungsstatistik', 'BFS employment statistics', 'Statistique de l’emploi de l’OFS', 'Statistica dell’impiego dell’UST', 'Статистика зайнятості BFS', 'إحصاءات التوظيف لمكتب الإحصاء BFS')}</a>
        <a href={regionalSource.workbookUrl} target="_blank" rel="noopener noreferrer" className={sourceLink}>{t('Originaltabelle herunterladen (XLSX)', 'Download the original table (XLSX)', 'Télécharger le tableau original (XLSX)', 'Scarica la tabella originale (XLSX)', 'Завантажити оригінальну таблицю (XLSX)', 'نزّل الجدول الأصلي (XLSX)')}</a>
        <a href={jobsUrl} target="_blank" rel="noopener noreferrer" className={sourceLink}>{jobsLabel}</a>
      </div>
    </section>
  );
}

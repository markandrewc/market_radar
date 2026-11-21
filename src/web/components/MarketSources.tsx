import sourceRegister from '@/data/source-register.json';
import sourceChecks from '@/data/source-checks.json';
import { useLanguage } from '@/i18n';

type MarketSourcesProps = {
  latestReportUrl: string | null;
  latestMonthLabel: string;
  cutoffLabel: string | null;
  csvCheckedLabel: string | null;
  skillProfileUrl: string | null;
  skillRoleLabel: string;
  skillReadLabel: string | null;
};

const sourceLink = 'font-medium text-teal-800 underline decoration-teal-400 underline-offset-4 hover:decoration-teal-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700';

const startSources = sourceRegister.sources.filter((source) => source.tier === 'start');
const reachableCount = sourceChecks.sources.filter((source) => source.attempt.status === 'reachable').length;

export default function MarketSources({
  latestReportUrl,
  latestMonthLabel,
  cutoffLabel,
  csvCheckedLabel,
  skillProfileUrl,
  skillRoleLabel,
  skillReadLabel,
}: MarketSourcesProps) {
  const { t, locale } = useLanguage();
  const registerDate = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' })
    .format(new Date(sourceRegister.verifiedOn));
  const lastSourceCheck = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Zurich',
  }).format(new Date(sourceChecks.completedAt));
  const summary = t(
    `${reachableCount} von ${sourceChecks.sources.length} beobachteten Behördenlinks waren beim letzten lokalen Abruf erreichbar. Abruf am ${lastSourceCheck}.`,
    `${reachableCount} of ${sourceChecks.sources.length} monitored government links responded at the last local check on ${lastSourceCheck}.`,
    `${reachableCount} des ${sourceChecks.sources.length} liens officiels suivis étaient accessibles lors de la dernière vérification locale le ${lastSourceCheck}.`,
    `${reachableCount} dei ${sourceChecks.sources.length} link ufficiali erano accessibili all’ultima verifica locale del ${lastSourceCheck}.`,
    `${reachableCount} із ${sourceChecks.sources.length} офіційних посилань були доступні під час останньої локальної перевірки ${lastSourceCheck}.`,
    `استجاب ${reachableCount} من أصل ${sourceChecks.sources.length} رابطًا حكوميًا عند آخر تحقق محلي في ${lastSourceCheck}.`,
  );
  const startLabels = {
    'itboard-monthly': t('ITBoard · IT-Stellen und Kenntnisse', 'ITBoard · IT vacancies and skills', 'ITBoard · Emplois et compétences IT', 'ITBoard · Posti IT e competenze', 'ITBoard · IT-вакансії та навички', 'ITBoard · وظائف ومهارات تقنية المعلومات'),
    'bfs-vacancies-region': t('BFS · Offene Stellen nach Grossregion', 'FSO · Vacancies by major region', 'OFS · Postes vacants par grande région', 'UST · Posti vacanti per grande regione', 'ФСУ · Вакансії за великими регіонами', 'مكتب الإحصاء · الوظائف الشاغرة حسب المنطقة الكبرى'),
    'bfs-vacancies-industry': t('BFS · Offene Stellen nach Wirtschaftsabteilung', 'FSO · Vacancies by industry', 'OFS · Postes vacants par activité économique', 'UST · Posti vacanti per attività economica', 'ФСУ · Вакансії за галузями', 'مكتب الإحصاء · الوظائف الشاغرة حسب القطاع'),
    'sem-asylum': t('SEM · Asylstatistik', 'SEM · Asylum statistics', 'SEM · Statistique en matière d’asile', 'SEM · Statistica dell’asilo', 'SEM · Статистика притулку', 'أمانة الهجرة · إحصاءات اللجوء'),
    'sem-work': t('SEM · Arbeiten im Asylbereich', 'SEM · Work and asylum status', 'SEM · Travail dans le domaine de l’asile', 'SEM · Lavoro nel settore dell’asilo', 'SEM · Працевлаштування у сфері притулку', 'أمانة الهجرة · العمل وحالة اللجوء'),
  };
  return (
    <section id="sources" aria-labelledby="market-sources-heading" className="rounded-xl border border-teal-200 bg-teal-50/70 p-5 text-sm text-slate-700">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="market-sources-heading" className="text-base font-semibold text-slate-900">{t('Datenquellen', 'Data sources', 'Sources de données', 'Fonti dei dati', 'Джерела даних', 'مصادر البيانات')}</h2>
        <a className={sourceLink} href="#context">{t('Kontext und Methode', 'Context and method', 'Contexte et méthode', 'Contesto e metodo', 'Контекст і методика', 'السياق والمنهجية')}</a>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="min-w-0 rounded-lg border border-teal-100 bg-white p-3">
          <h3 className="font-semibold text-slate-900">{t('Stellenzahlen pro Monat', 'Monthly vacancy figures', 'Nombre mensuel de postes', 'Posti vacanti per mese', 'Кількість вакансій за місяцями', 'أعداد الوظائف الشاغرة شهريًا')}</h3>
          <p className="mt-1">
            {t('ITBoard-Stichprobe zu Schweizer IT-Inseraten.', 'ITBoard sample of Swiss IT listings.', 'Échantillon ITBoard d’offres informatiques suisses.', 'Campione ITBoard di annunci IT svizzeri.', 'Вибірка швейцарських IT-вакансій ITBoard.', 'عينة من إعلانات الوظائف التقنية السويسرية على ITBoard.')} {latestReportUrl ? (
              <a className={sourceLink} href={latestReportUrl} target="_blank" rel="noopener noreferrer">{t('Bericht', 'Report', 'Rapport', 'Rapporto', 'Звіт', 'تقرير')} {latestMonthLabel}</a>
            ) : latestMonthLabel}.
            {cutoffLabel && <> {t('Stichtag', 'Reference date', 'Date de référence', 'Data di riferimento', 'Дата даних', 'التاريخ المرجعي')} {cutoffLabel}.</>}
            {csvCheckedLabel && <> {t('CSV abgerufen am', 'CSV retrieved on', 'CSV récupéré le', 'CSV scaricato il', 'CSV отримано', 'جُلِب الملف في')} {csvCheckedLabel}.</>}
          </p>
          <p className="mt-1">
            <a className={sourceLink} href="https://www.itboard.ch/arbeitsmarkt/daten.csv" target="_blank" rel="noopener noreferrer">ITBoard (CSV)</a>
            {' · '}
            <a className={sourceLink} href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>
          </p>
        </div>
        <div className="min-w-0 rounded-lg border border-teal-100 bg-white p-3">
          <h3 className="font-semibold text-slate-900">{t('Kenntnisse', 'Skills', 'Compétences', 'Competenze', 'Навички', 'المهارات')} · {skillRoleLabel}</h3>
          {skillProfileUrl && skillReadLabel ? (
            <>
              <p className="mt-1">{t('Stichprobe aus dem Berufsprofil. Abruf am', 'Sample from the role profile. Retrieved on', 'Échantillon du profil métier. Consulté le', 'Campione del profilo professionale. Consultato il', 'Вибірка з профілю професії. Переглянуто', 'عينة من الملف المهني. تم الاطلاع في')} {skillReadLabel}.</p>
              <p className="mt-1"><a className={sourceLink} href={skillProfileUrl} target="_blank" rel="noopener noreferrer">ITBoard · {skillRoleLabel}</a></p>
            </>
          ) : <p className="mt-1">{t(
            'Für diese Rolle stehen Praxisbeispiele zur Verfügung. Eine veröffentlichte Kenntnis-Stichprobe fehlt.',
            'This role has practical examples. Published skill sample figures are unavailable.',
            'Des exemples pratiques sont disponibles. Les chiffres d’un échantillon de compétences manquent.',
            'Sono disponibili esempi pratici. Mancano i dati pubblicati di un campione di competenze.',
            'Для цієї професії є практичні приклади. Опублікованої вибірки навичок немає.',
            'تتوفر أمثلة عملية لهذه المهنة. بيانات العينة المنشورة للمهارات غير متاحة.',
          )}</p>}
        </div>
      </div>
      <nav aria-label={t('Fortlaufend gepflegte Quellen', 'Continuously maintained sources', 'Sources régulièrement mises à jour', 'Fonti aggiornate regolarmente', 'Джерела, що регулярно оновлюються', 'مصادر تُحدّث باستمرار')} className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
        {startSources.map(({ id, url, name }) => (
          <a key={id} className={sourceLink} href={url} target="_blank" rel="noopener noreferrer">{startLabels[id as keyof typeof startLabels] ?? name}</a>
        ))}
      </nav>
      <details className="mt-4 border-t border-teal-200 pt-3" id="source-register">
        <summary className="w-fit cursor-pointer font-semibold text-teal-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700">{t('Quellenregister für die BI-Übergabe', 'BI source register (German)', 'Registre des sources BI (allemand)', 'Registro delle fonti BI (tedesco)', 'Реєстр джерел для BI (німецькою)', 'سجل مصادر تحليل البيانات (بالألمانية)')}</summary>
        <p className="mt-2">{t('Fortlaufende Einstiege und der Weg zur neuesten Ausgabe. Geprüft am', 'Stable entry points and how to find the latest release. Verified on', 'Liens permanents et accès aux dernières publications. Vérifié le', 'Link permanenti e accesso alle ultime pubblicazioni. Verificato il', 'Сталі посилання та пошук останніх випусків. Перевірено', 'روابط دائمة وطريقة العثور على أحدث إصدار. تم التحقق في')} {registerDate}.</p>
        <p className="mt-1">{summary}</p>
        <ul lang="de-CH" dir="ltr" className="mt-3 grid list-none gap-3 lg:grid-cols-2">
          {sourceRegister.sources.map(({ id, name, url, cadence, access, description, discovery, limit, links }) => (
            <li key={id} className="min-w-0 rounded-lg border border-teal-100 bg-white p-3">
              <h3 className="font-semibold"><a className={sourceLink} href={url} target="_blank" rel="noopener noreferrer">{name}</a></h3>
              <p className="mt-1 text-xs text-slate-600">{access} · {cadence}</p>
              <p className="mt-2">{description}</p>
              <p className="mt-1">{discovery}</p>
              <p className="mt-2 text-xs text-slate-700">{limit}</p>
              {links.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                  {links.map((link) => (
                    <li key={link.url}><a className={sourceLink} href={link.url} target="_blank" rel="noopener noreferrer">{link.label}</a></li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
        <div lang="de-CH" dir="ltr" className="mt-4 text-sm">
          <h3 className="font-semibold">Offene Abdeckung</h3>
          {sourceRegister.openCoverage.map(({ label, description }) => (
            <p key={label} className="mt-1"><strong>{label}.</strong> {description}</p>
          ))}
        </div>
      </details>
    </section>
  );
}

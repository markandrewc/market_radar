type MarketSourcesProps = {
  latestReportUrl: string | null;
  latestMonthLabel: string;
  cutoffLabel: string | null;
  csvCheckedLabel: string | null;
  skillProfileUrl: string;
  skillRoleLabel: string;
  skillReadLabel: string;
};

const sourceLink = 'font-medium text-teal-800 underline decoration-teal-400 underline-offset-4 hover:decoration-teal-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700';

const references = [
  {
    name: 'Federal Statistical Office (BFS)',
    url: 'https://statistik.admin.ch/en/asset/36832599',
    description: 'Quarterly estimates of open Swiss positions in selected economic divisions.',
  },
  {
    name: 'SEM · Employment in the asylum system',
    url: 'https://www.sem.admin.ch/de/arbeit-asylbereich',
    description: 'Official guidance on entry to work, notifications and permits by residence status.',
  },
  {
    name: 'SEM · Asylum statistics',
    url: 'https://www.sem.admin.ch/de/asylstatistik',
    description: 'Published aggregate figures on the asylum population and employment by status in selected tables.',
  },
  {
    name: 'Fedlex',
    url: 'https://www.fedlex.admin.ch/eli/cc/2007/758/de',
    description: 'Official text of the Federal Act on Foreign Nationals and Integration.',
  },
  {
    name: 'Swiss Parliament · Open Data',
    url: 'https://www.parlament.ch/de/%C3%BCber-das-parlament/fakten-und-zahlen/open-data-web-services',
    description: 'Parliamentary business and documentation for the new web service, which requires an API key.',
  },
  {
    name: 'ESCO',
    url: 'https://esco.ec.europa.eu/en/use-esco/use-esco-services-api/esco-web-service-api',
    description: 'Multilingual European classification of occupations and skills.',
  },
  {
    name: 'Job-Room',
    url: 'https://www.job-room.ch/job-search',
    description: 'Public Swiss vacancy search for individual listings.',
  },
  {
    name: 'Adzuna · API documentation',
    url: 'https://developer.adzuna.com/activedocs',
    description: 'Documents Swiss job search (country code ch), API credentials and available endpoints.',
  },
];

export default function MarketSources({
  latestReportUrl,
  latestMonthLabel,
  cutoffLabel,
  csvCheckedLabel,
  skillProfileUrl,
  skillRoleLabel,
  skillReadLabel,
}: MarketSourcesProps) {
  return (
    <section id="sources" aria-labelledby="market-sources-heading" className="rounded-xl border border-teal-200 bg-teal-50/70 p-5 text-sm text-slate-700">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="market-sources-heading" className="text-base font-semibold text-slate-900">Data sources</h2>
        <a className={sourceLink} href="#context">Context and methodology</a>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="min-w-0 rounded-lg border border-teal-100 bg-white p-3">
          <h3 className="font-semibold text-slate-900">Monthly job postings</h3>
          <p className="mt-1">
            An ITBoard sample of Swiss IT listings. {latestReportUrl ? (
              <a className={sourceLink} href={latestReportUrl} target="_blank" rel="noopener noreferrer">{latestMonthLabel} report</a>
            ) : latestMonthLabel}.
            {cutoffLabel && <> Data cutoff {cutoffLabel}.</>}
            {csvCheckedLabel && <> CSV retrieved {csvCheckedLabel}.</>}
          </p>
          <p className="mt-1">
            <a className={sourceLink} href="https://www.itboard.ch/arbeitsmarkt/daten.csv" target="_blank" rel="noopener noreferrer">ITBoard data CSV</a>
            {' · '}
            <a className={sourceLink} href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>
          </p>
        </div>
        <div className="min-w-0 rounded-lg border border-teal-100 bg-white p-3">
          <h3 className="font-semibold text-slate-900">Skills for {skillRoleLabel}</h3>
          <p className="mt-1">The role profile uses its own sample of listings. Profile checked {skillReadLabel}.</p>
          <p className="mt-1">
            <a className={sourceLink} href={skillProfileUrl} target="_blank" rel="noopener noreferrer">ITBoard profile for {skillRoleLabel}</a>
          </p>
        </div>
      </div>
      <details className="mt-3 border-t border-teal-200 pt-3">
        <summary className="w-fit cursor-pointer font-semibold text-teal-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700">Further references</summary>
        <p className="mt-2">These links give context and options for future connections. The demand chart and skills table use ITBoard data.</p>
        <ul className="mt-3 grid list-none gap-x-5 gap-y-2 sm:grid-cols-2">
          {references.map(({ name, url, description }) => (
            <li key={url}>
              <a className={sourceLink} href={url} target="_blank" rel="noopener noreferrer">{name}</a>
              <p>{description}</p>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

import { useLanguage } from '@/i18n';
import { migrationHeadings, migrationLinks, migrationTopics, type Copy } from './migration-watch-copy';

export default function MigrationWatch() {
  const { t } = useLanguage();
  const translate = (copy: Copy) => t(...copy);

  return (
    <section id="migration-watch" aria-labelledby="migration-watch-title" className="mt-5 min-w-0 space-y-3">
      <header>
        <h3 id="migration-watch-title" className="text-lg font-semibold text-slate-900">{t(...migrationHeadings.title)}</h3>
        <p className="mt-1 text-sm text-slate-700">{t(...migrationHeadings.description)}</p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2">
        {migrationTopics.map(({ id, title, status, summary, why, check, links }) => (
          <article
            key={id}
            aria-labelledby={id + '-title'}
            className="flex min-w-0 flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"
          >
            <p className="text-xs font-semibold text-teal-800">{translate(status)}</p>
            <h4 id={id + '-title'} className="text-base font-semibold text-slate-900">{translate(title)}</h4>
            <p>{translate(summary)}</p>
            <dl className="space-y-2">
              <div>
                <dt className="font-semibold text-slate-900">{t(...migrationHeadings.why)}</dt>
                <dd>{translate(why)}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-900">{t(...migrationHeadings.check)}</dt>
                <dd>{translate(check)}</dd>
              </div>
            </dl>
            <ul className="mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-1" aria-label={t(...migrationHeadings.sources)}>
              {links.map((source) => {
                const { label, url } = migrationLinks[source];
                return (
                  <li key={url}>
                    <a className="font-medium text-teal-800 underline underline-offset-4 hover:text-teal-950" href={url} target="_blank" rel="noopener noreferrer">
                      {translate(label)}
                    </a>
                  </li>
                );
              })}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}

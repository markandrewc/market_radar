import { Link } from 'react-router-dom';
import type { Digest, SourceRef } from '../../shared/types';

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
};

/** The provenance line for one bullet: who published it, when, and where to check it. */
function Citation({ source }: { source: SourceRef }) {
  return (
    <p className="mt-1 text-xs text-slate-500">
      <span className="font-medium text-slate-600">{source.name}</span>
      {source.dataAsOf ? <span> · data as of {formatDate(source.dataAsOf)}</span> : null}
      <span> · retrieved {formatDate(source.fetchedAt)}</span>
      {' · '}
      <a href={source.url} target="_blank" rel="noreferrer" className="break-all text-brand-accent underline">
        {source.url}
      </a>
    </p>
  );
}

/**
 * Renders the briefing exactly as it would arrive: subject, generation time, every section and
 * every bullet with its own citation, our reading kept separate from the source text, and the
 * list of sources used. An empty digest says why and points at the sources page instead of
 * inventing a number.
 */
export function DigestPreview({ digest }: { digest: Digest }) {
  const uniqueSources = Array.from(new Map(digest.sources.map((source) => [source.id || source.url, source])).values());

  return (
    <article aria-label="Briefing preview" className="space-y-4 rounded-lg border border-slate-200 bg-brand-soft p-4">
      <header className="space-y-1">
        <h4 className="text-base font-semibold text-brand">{digest.subject}</h4>
        <p className="text-xs text-slate-500">generated {formatDateTime(digest.generatedAt)}</p>
      </header>

      {digest.empty ? (
        <div className="space-y-3 text-sm text-slate-700">
          <p>{digest.text || 'There is nothing to report for the selected topics yet.'}</p>
          <Link to="/sources" className="inline-block text-sm font-medium text-brand-accent underline">
            See which sources we check →
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {digest.sections.map((section, index) => (
            <section key={`${section.heading}-${index}`} className="space-y-2">
              <h5 className="text-sm font-semibold text-brand">{section.heading}</h5>
              <ul className="space-y-3">
                {section.bullets.map((bullet, bulletIndex) => (
                  <li key={`${bullet.text}-${bulletIndex}`} className="text-sm">
                    <p className="text-slate-800">{bullet.text}</p>
                    <Citation source={bullet.source} />
                  </li>
                ))}
              </ul>
              {section.note ? (
                <div className="rounded-md border-l-2 border-brand-accent bg-white px-3 py-2 text-xs italic text-slate-600">
                  <span className="font-medium not-italic text-slate-500">Our reading, not the source: </span>
                  {section.note}
                </div>
              ) : null}
            </section>
          ))}
        </div>
      )}

      {uniqueSources.length > 0 && (
        <footer className="space-y-1 border-t border-slate-200 pt-3">
          <h5 className="text-xs font-medium uppercase tracking-wide text-slate-500">Sources in this briefing</h5>
          <ul className="space-y-1 text-xs text-slate-600">
            {uniqueSources.map((source) => (
              <li key={source.id || source.url}>
                <a href={source.url} target="_blank" rel="noreferrer" className="break-all text-brand-accent underline">
                  {source.name}
                </a>
                {source.dataAsOf ? <span> · data as of {formatDate(source.dataAsOf)}</span> : null}
                <span> · retrieved {formatDate(source.fetchedAt)}</span>
              </li>
            ))}
          </ul>
        </footer>
      )}
    </article>
  );
}

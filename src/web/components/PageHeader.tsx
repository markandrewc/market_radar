import type { ReactNode } from 'react';
import { usePageTitle } from '../hooks';

/** Page opener: kicker → h1 → lede → optional actions → warm hairline. Sets the document title. */
export function PageHeader({ title, description, kicker, actions }: { title: string; description?: string; kicker?: string; actions?: ReactNode }) {
  usePageTitle(title);
  return (
    <header className="mt-6 border-b border-line pb-6">
      {kicker && <div className="kicker">{kicker}</div>}
      <h1 className="display mt-3 text-4xl sm:text-5xl">{title}</h1>
      {description && <p className="mt-3 max-w-3xl text-base text-ink-soft sm:text-lg">{description}</p>}
      {actions && <div className="mt-6 flex flex-wrap items-center gap-3">{actions}</div>}
    </header>
  );
}

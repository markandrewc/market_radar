import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

/**
 * The four levels of the challenge, as a navigation row. Each level keeps a
 * short name plus its number, so a coach can tell where they are in the story.
 */
const levels = [
  { number: 1, label: 'Market & skills', to: '/', matches: ['/'] },
  { number: 2, label: 'Weekly briefing', to: '/reports', matches: ['/reports'] },
  { number: 3, label: 'People, employers & policy', to: '/context', matches: ['/context', '/policy', '/participants'] },
  { number: 4, label: 'Data sources', to: '/sources', matches: ['/sources', '/items'] },
] as const;

function isCurrent(pathname: string, matches: readonly string[]): boolean {
  return matches.some((base) => (base === '/' ? pathname === '/' : pathname.startsWith(base)));
}

export function LevelTabs({ className }: { className?: string }) {
  const { pathname } = useLocation();
  return (
    <nav aria-label="Levels" className={cn('flex items-center gap-1 overflow-x-auto', className)}>
      {levels.map((level) => {
        const active = isCurrent(pathname, level.matches);
        return (
          <Link
            key={level.to}
            to={level.to}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'group inline-flex shrink-0 items-center gap-2 rounded-control px-3 py-2 text-sm transition-colors',
              active
                ? 'bg-brand-soft font-semibold text-ink'
                : 'text-ink-soft hover:bg-brand-soft/60 hover:text-ink',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold tnum',
                active ? 'bg-brand-accent text-white' : 'bg-line text-ink-soft group-hover:bg-line-strong',
              )}
            >
              {level.number}
            </span>
            <span className="whitespace-nowrap">{level.label}</span>
            <span className="sr-only"> (Level {level.number})</span>
          </Link>
        );
      })}
    </nav>
  );
}

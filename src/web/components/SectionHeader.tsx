import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Section opener: kicker → h2 → description, with an optional right-aligned action
 * (a "View all" link, a filter control) and a closing warm hairline.
 */
export function SectionHeader({ kicker, title, description, action, id, className }: {
  kicker?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  /** Set when a section uses this heading as its `aria-labelledby` target. */
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4', className)}>
      <div className="min-w-0 space-y-2">
        {kicker && <p className="kicker">{kicker}</p>}
        <h2 id={id} className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{title}</h2>
        {description && <p className="max-w-3xl text-sm text-ink-soft sm:text-base">{description}</p>}
      </div>
      {action && <div className="shrink-0 pb-0.5">{action}</div>}
    </div>
  );
}

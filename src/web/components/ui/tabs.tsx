import { useId, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface TabDef { id: string; label: string; content: ReactNode }

/** Tabs with arrow-key navigation (Left/Right/Home/End), as screen-reader users expect. */
export function Tabs({ tabs, label }: { tabs: TabDef[]; label: string }) {
  const uid = useId();
  const [current, setCurrent] = useState(tabs[0]?.id);
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const idx = Math.max(0, tabs.findIndex((t) => t.id === current));

  const move = (to: number) => {
    const t = tabs[(to + tabs.length) % tabs.length];
    setCurrent(t.id);
    refs.current[t.id]?.focus();
  };

  return (
    <div>
      <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto border-b border-line"
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') { e.preventDefault(); move(idx + 1); }
          if (e.key === 'ArrowLeft') { e.preventDefault(); move(idx - 1); }
          if (e.key === 'Home') { e.preventDefault(); move(0); }
          if (e.key === 'End') { e.preventDefault(); move(tabs.length - 1); }
        }}>
        {tabs.map((t) => {
          const on = t.id === tabs[idx].id;
          return (
            <button key={t.id} ref={(el) => { refs.current[t.id] = el; }} type="button" role="tab" id={`${uid}-tab-${t.id}`}
              aria-selected={on} aria-controls={`${uid}-panel-${t.id}`} tabIndex={on ? 0 : -1} onClick={() => setCurrent(t.id)}
              className={cn('-mb-px whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                on ? 'border-brand-accent text-ink' : 'border-transparent text-ink-soft hover:bg-paper hover:text-ink')}>
              {t.label}
            </button>
          );
        })}
      </div>
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" id={`${uid}-panel-${t.id}`} aria-labelledby={`${uid}-tab-${t.id}`} hidden={t.id !== tabs[idx].id} className="pt-5">
          {t.id === tabs[idx].id && t.content}
        </div>
      ))}
    </div>
  );
}

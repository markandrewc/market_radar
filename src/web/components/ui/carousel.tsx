import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './button';

/** Swipeable on touch, arrows and dots with a mouse, and scrollable with the arrow keys. */
export function Carousel({ label, children }: { label: string; children: ReactNode }) {
  const items = Children.toArray(children);
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [edges, setEdges] = useState({ start: true, end: false });

  const update = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const w = (el.firstElementChild as HTMLElement | null)?.offsetWidth ?? el.clientWidth;
    setActive(Math.min(items.length - 1, Math.round(el.scrollLeft / (w + 16))));
    setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, [items.length]);

  useEffect(() => { update(); window.addEventListener('resize', update); return () => window.removeEventListener('resize', update); }, [update]);

  const go = (i: number) => {
    const el = track.current;
    const child = el?.children[Math.max(0, Math.min(items.length - 1, i))] as HTMLElement | undefined;
    if (el && child && typeof el.scrollTo === 'function') el.scrollTo({ left: child.offsetLeft - el.offsetLeft, behavior: 'smooth' });
  };

  return (
    <section aria-roledescription="carousel" aria-label={label} className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600" aria-live="polite">{items.length > 1 ? `Item ${active + 1} of ${items.length}` : ''}</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => go(active - 1)} disabled={edges.start} aria-label={`Previous: ${label}`}><ChevronLeft className="h-4 w-4" aria-hidden /></Button>
          <Button variant="outline" size="sm" onClick={() => go(active + 1)} disabled={edges.end} aria-label={`Next: ${label}`}><ChevronRight className="h-4 w-4" aria-hidden /></Button>
        </div>
      </div>
      <div
        ref={track} onScroll={update} tabIndex={0} role="region" aria-label={`${label} (use the left and right arrow keys to scroll)`}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2"
        onKeyDown={(e) => { if (e.key === 'ArrowRight') { e.preventDefault(); go(active + 1); } if (e.key === 'ArrowLeft') { e.preventDefault(); go(active - 1); } }}
      >
        {items.map((child, i) => (
          <div key={i} role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${items.length}`}
            className="shrink-0 basis-full snap-start md:basis-[calc(50%-0.5rem)] lg:basis-[calc(33.333%-0.7rem)]">
            {child}
          </div>
        ))}
      </div>
      {items.length > 1 && (
        <div className="flex justify-center gap-2" role="group" aria-label="Choose an item">
          {items.map((_, i) => (
            <button key={i} type="button" onClick={() => go(i)} aria-label={`Go to item ${i + 1}`} aria-current={i === active ? 'true' : undefined}
              className="flex h-6 w-6 items-center justify-center">
              <span className={`block h-2.5 rounded-full transition-all ${i === active ? 'w-6 bg-brand-accent' : 'w-2.5 bg-slate-300'}`} />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

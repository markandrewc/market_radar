import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';

/** 1 … 4 5 6 … 20: always the first, the last and the neighbours of the current page. */
export function pageWindow(page: number, count: number): (number | '…')[] {
  const keep = new Set([1, count, page - 1, page, page + 1].filter((n) => n >= 1 && n <= count));
  const out: (number | '…')[] = [];
  let prev = 0;
  for (const n of [...keep].sort((a, b) => a - b)) { if (n - prev > 1) out.push('…'); out.push(n); prev = n; }
  return out;
}

export function Pagination({ page, pageCount, total, size, onChange, label }:
  { page: number; pageCount: number; total: number; size: number; onChange: (p: number) => void; label: string }) {
  if (pageCount <= 1) return null;
  const from = (page - 1) * size + 1, to = Math.min(total, page * size);
  return (
    <nav aria-label={label} className="flex flex-wrap items-center justify-between gap-3 pt-2">
      <p className="text-sm text-slate-600" aria-live="polite">Showing {from}–{to} of {total}</p>
      <ul className="flex items-center gap-1">
        <li><Button variant="outline" size="sm" onClick={() => onChange(page - 1)} disabled={page === 1} aria-label="Previous page"><ChevronLeft className="h-4 w-4" aria-hidden />Previous</Button></li>
        {pageWindow(page, pageCount).map((n, i) => n === '…' ? (
          <li key={`gap-${i}`} aria-hidden className="hidden px-1 text-slate-500 sm:block">…</li>
        ) : (
          <li key={n} className="hidden sm:block">
            <button type="button" onClick={() => onChange(n)} aria-label={`Page ${n}`} aria-current={n === page ? 'page' : undefined}
              className={cn('h-9 min-w-9 rounded-md border px-2 text-sm', n === page ? 'border-brand-accent bg-brand-accent font-semibold text-white' : 'border-slate-300 bg-white text-brand hover:bg-slate-50')}>
              {n}
            </button>
          </li>
        ))}
        <li><Button variant="outline" size="sm" onClick={() => onChange(page + 1)} disabled={page === pageCount} aria-label="Next page">Next<ChevronRight className="h-4 w-4" aria-hidden /></Button></li>
      </ul>
    </nav>
  );
}

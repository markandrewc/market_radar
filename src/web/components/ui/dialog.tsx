import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from './button';

/** Modal built on the native <dialog>: focus stays inside, Esc closes, focus returns to the opener. */
export function Dialog({ open, onClose, title, kicker, children }:
  { open: boolean; onClose: () => void; title: string; kicker?: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      opener.current = document.activeElement as HTMLElement | null;
      if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
    }
    if (!open && d.open) {
      if (typeof d.close === 'function') d.close(); else d.removeAttribute('open');
      opener.current?.focus();
    }
  }, [open]);

  return (
    <dialog ref={ref} aria-labelledby="dialog-title" onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
      className="m-auto w-[min(92vw,34rem)] rounded-card border border-line bg-surface p-0 text-ink shadow-float backdrop:bg-ink/50">
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            {kicker && <p className="kicker">{kicker}</p>}
            <h2 id="dialog-title" className="text-xl font-semibold tracking-tight text-ink">{title}</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close"><X className="h-5 w-5" aria-hidden /></Button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

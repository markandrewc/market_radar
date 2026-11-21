import type { ReactNode } from 'react';

/**
 * A mail-client frame for the briefing preview: window chrome, envelope rows and
 * the body slot. The values come from the digest that is actually sent, so the
 * preview never shows anything the e-mail would not contain.
 */
export function EmailFrame({
  from,
  to,
  subject,
  date,
  tourId,
  children,
}: {
  from: string;
  to?: string;
  subject: string;
  date: string;
  /** Optional data-tour anchor (guided tour). */
  tourId?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-label="E-mail preview"
      data-tour={tourId}
      className="overflow-hidden rounded-card border border-line bg-surface shadow-float"
    >
      <div className="flex items-center justify-between gap-3 border-b border-line bg-brand-soft/70 px-4 py-2.5">
        <div className="flex items-center gap-2" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-brand-accent/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
        </div>
        <p className="meta truncate">Live e-mail preview — Powercoders weekly briefing</p>
        <span className="meta hidden sm:inline">HTML</span>
      </div>
      <dl className="grid gap-1 border-b border-line px-4 py-3 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-4">
        <dt className="text-ink-soft">From</dt>
        <dd className="font-medium text-ink">{from}</dd>
        {to && (
          <>
            <dt className="text-ink-soft">To</dt>
            <dd className="break-all text-ink">{to}</dd>
          </>
        )}
        <dt className="text-ink-soft">Date</dt>
        <dd className="text-ink">{date}</dd>
        <dt className="text-ink-soft">Subject</dt>
        <dd className="font-semibold text-ink">{subject}</dd>
      </dl>
      <div className="max-h-[42rem] overflow-y-auto bg-paper/40 p-4 sm:p-6">{children}</div>
    </section>
  );
}

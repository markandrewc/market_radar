import { Dialog } from './ui/dialog';
import { Button } from './ui/button';
import { ArrowRight, Compass, Keyboard, MapPin } from 'lucide-react';

const levels = [
  ['Level 1', 'Market & skills', 'How many jobs are open and which skills employers ask for.'],
  ['Level 2', 'Weekly briefing', 'A short, sourced summary you can subscribe to by e-mail.'],
  ['Level 3', 'People, employers & policy', 'Who is hiring, who our participants are, who could help.'],
  ['Level 4', 'Data sources', 'Where every number comes from, and how to add a source.'],
];

/**
 * The entry point to the guided tour. The tour itself is a spotlight over the
 * real interface (`TourOverlay`); this dialog only explains the idea and lets
 * people choose how much they want to see.
 */
export function HelpDialog({
  open,
  onClose,
  onStartQuick,
  onStartFull,
}: {
  open: boolean;
  onClose: () => void;
  onStartQuick: () => void;
  onStartFull: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} kicker="Guided tour" title="How to use Market Radar">
      <p className="text-[15px] leading-relaxed text-ink-soft">
        Market Radar shows where the Swiss IT job market is heading and what it means for our programme. The
        guided tour walks through the real pages and points at the part being explained — no technical knowledge
        needed.
      </p>

      <ul className="mt-4 divide-y divide-line rounded-card border border-line">
        {levels.map(([level, name, text]) => (
          <li key={level} className="flex gap-3 px-4 py-3">
            <span className="mt-0.5 inline-flex h-5 shrink-0 items-center rounded-full bg-brand-soft px-2 text-[11px] font-semibold text-ink">
              {level}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-ink">{name}</span>
              <span className="block text-sm text-ink-soft">{text}</span>
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-3 flex items-center gap-2 text-xs text-ink-soft">
        <Keyboard className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Keyboard: Esc ends the tour, arrow keys move between steps.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button onClick={onStartQuick}>
          <Compass className="h-4 w-4" aria-hidden />
          Start quick tour (5 steps)
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Button>
        <Button variant="outline" onClick={onStartFull}>
          <MapPin className="h-4 w-4" aria-hidden />
          Full tour (10 steps)
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Not now
        </Button>
      </div>
    </Dialog>
  );
}

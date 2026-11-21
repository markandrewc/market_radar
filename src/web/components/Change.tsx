import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { Badge } from './ui/badge';

/**
 * Up/down/no change, always with an arrow, a signed number and a word for screen
 * readers — colour is never the only signal. `suffix` says what the change is over.
 */
export function Change({ pct, suffix }: { pct: number; suffix?: string }) {
  const rounded = Math.round(pct * 10) / 10;
  const trailing = suffix ? ` ${suffix}` : '';
  if (rounded === 0) {
    return (
      <Badge variant="secondary" className="tnum">
        <Minus className="h-3 w-3" aria-hidden />
        No change{trailing}
      </Badge>
    );
  }
  const up = rounded > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <Badge variant={up ? 'success' : 'warning'} className="tnum">
      <Icon className="h-3 w-3" aria-hidden />
      <span className="sr-only">{up ? 'Up' : 'Down'} </span>
      {up ? '+' : '−'}{Math.abs(rounded)}%{trailing}
    </Badge>
  );
}

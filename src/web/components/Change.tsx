import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { Badge } from './ui/badge';

/** Up/down/no change, always with text and an icon (never colour alone). */
export function Change({ pct, suffix }: { pct: number; suffix?: string }) {
  if (pct === 0) return <Badge variant="secondary"><Minus className="mr-1 h-3 w-3" aria-hidden />No change{suffix ? ` ${suffix}` : ''}</Badge>;
  const up = pct > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <Badge variant={up ? 'success' : 'warning'}>
      <Icon className="mr-1 h-3 w-3" aria-hidden />
      {up ? 'Up' : 'Down'} {Math.abs(pct)}%{suffix ? ` ${suffix}` : ''}
    </Badge>
  );
}

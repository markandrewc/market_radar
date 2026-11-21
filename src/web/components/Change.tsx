import { TrendingDown, TrendingUp } from 'lucide-react';
import { Badge } from './ui/badge';

export function Change({ pct }: { pct: number }) {
  const up = pct >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <Badge variant={up ? 'success' : 'warning'}>
      <Icon className="mr-1 h-3 w-3" />
      {up ? '+' : ''}{pct}%
    </Badge>
  );
}

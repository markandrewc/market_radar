import { Line, LineChart, ResponsiveContainer } from 'recharts';
import type { Point } from '../../shared/types';

export function Sparkline({ series }: { series: Point[] }) {
  if (series.length < 2) return null;
  return (
    <div className="h-12" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={series}>
          <Line type="monotone" dataKey="value" stroke="#a8324e" strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

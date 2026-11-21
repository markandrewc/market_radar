import { useId } from 'react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import type { Point } from '../../shared/types';
import { CHART } from '../charts/theme';

/** Tiny trend for cards: no axes, no dots, a crimson line over a fading wash. Decorative only. */
export function Sparkline({ series }: { series: Point[] }) {
  const uid = useId().replace(/[:]/g, '');
  if (series.length < 2) return null;
  const gradientId = `spark-${uid}`;
  return (
    <div className="h-12" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART.accent} stopOpacity={0.18} />
              <stop offset="100%" stopColor={CHART.accent} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={CHART.accent}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ForecastPoint, Point } from '../../shared/types';

const COLOUR = '#a8324e';

type Row = {
  period: string;
  label: string;
  kind: 'history' | 'forecast';
  history: number | null;
  forecast: number | null;
  low: number | null;
  band: number | null;
};

function monthLabel(period: string): string {
  const [year, month] = period.split('-').map(Number);
  if (!year || !month) return period;
  return new Date(year, month - 1, 1).toLocaleString('en-GB', { month: 'short', year: '2-digit' });
}

type TooltipEntry = { payload?: Row };

/** Tooltip that marks forecast months as our estimate, never as reported data. */
function ForecastTooltip({ active, payload }: { active?: boolean; payload?: TooltipEntry[] }) {
  const row = payload?.find((entry) => entry.payload)?.payload;
  if (!active || !row) return null;
  const isForecast = row.kind === 'forecast';
  const value = isForecast ? row.forecast : row.history;
  const high = row.low !== null && row.band !== null ? row.low + row.band : null;
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-brand">{row.label}</p>
      <p className="text-slate-700">{isForecast ? 'Forecast' : 'Reported'}: {value}</p>
      {isForecast && row.low !== null && high !== null && (
        <p className="text-slate-600">95 % range: {row.low} to {high}</p>
      )}
      {isForecast && <p className="mt-1 font-medium text-amber-800">Extrapolation, not a promise.</p>}
    </div>
  );
}

/**
 * Monthly history as a solid line, with an optional forecast: dashed line plus a
 * subtle 95 % band. The dashed part is always labelled as an extrapolation, both in
 * the tooltip and in the visible legend, and the whole chart has a text alternative.
 */
export function ForecastChart({
  series,
  forecast,
  label,
  height = 240,
}: {
  series: Point[];
  forecast?: ForecastPoint[] | null;
  label: string;
  height?: number;
}) {
  const history = [...series].sort((a, b) => a.period.localeCompare(b.period));
  const future = [...(forecast ?? [])]
    .filter((point) => Number.isFinite(point.value))
    .sort((a, b) => a.period.localeCompare(b.period));
  const latest = history.at(-1);

  if (!latest) {
    return <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">No monthly figures to show yet.</p>;
  }

  const rows: Row[] = history.map((point, index) => ({
    period: point.period,
    label: monthLabel(point.period),
    kind: 'history',
    history: point.value,
    // Join the dashed line to the last reported month so the eye can follow the trend.
    forecast: future.length > 0 && index === history.length - 1 ? point.value : null,
    low: null,
    band: null,
  }));

  for (const point of future) {
    const low = Number.isFinite(point.low) ? point.low : null;
    const high = Number.isFinite(point.high) ? point.high : null;
    rows.push({
      period: point.period,
      label: monthLabel(point.period),
      kind: 'forecast',
      history: null,
      forecast: point.value,
      low,
      band: low !== null && high !== null ? Math.max(0, high - low) : null,
    });
  }

  const hasForecast = future.length > 0;
  const ariaLabel = [
    `Chart: ${label}.`,
    `Reported months from ${monthLabel(history[0].period)} to ${monthLabel(latest.period)}; latest value ${latest.value}.`,
    hasForecast ? 'The dashed part is our forecast: an extrapolation, not a promise.' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const showDots = history.length <= 14;

  return (
    <figure className="space-y-2">
      <div role="img" aria-label={ariaLabel} className="w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} minTickGap={20} />
            <YAxis tickLine={false} axisLine={false} fontSize={12} width={44} />
            <Tooltip content={<ForecastTooltip />} cursor={{ stroke: '#94a3b8', strokeDasharray: '3 3' }} />
            {/* The 95 % band: a transparent base to `low`, then the low→high fill stacked on top. */}
            <Area type="monotone" dataKey="low" stackId="band" stroke="none" fill="transparent" isAnimationActive={false} activeDot={false} />
            <Area type="monotone" dataKey="band" stackId="band" stroke="none" fill={COLOUR} fillOpacity={0.14} isAnimationActive={false} activeDot={false} />
            <Line
              type="monotone"
              dataKey="history"
              stroke={COLOUR}
              strokeWidth={2.5}
              dot={showDots ? { r: 2.5, strokeWidth: 0, fill: COLOUR } : false}
              connectNulls={false}
              isAnimationActive={false}
            />
            {hasForecast && (
              <Line
                type="monotone"
                dataKey="forecast"
                stroke={COLOUR}
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="text-xs text-slate-600">
        <span className="font-medium text-brand">Solid line:</span> months the source reported.
        {hasForecast && (
          <>
            {' '}
            <span className="font-medium text-brand">Dashed line:</span> our forecast — an extrapolation, not a promise. The shaded band is the 95 % range.
          </>
        )}
      </figcaption>
    </figure>
  );
}

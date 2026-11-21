/**
 * Shared chart theme for Market Radar (docs/DESIGN.md).
 *
 * Recharts needs real colour values instead of CSS classes, so the design tokens
 * from `src/web/index.css` are mirrored here as hex constants. Keep the two files
 * in step: crimson is for data, warm hairlines for structure, graphite for ink.
 */

export const CHART = {
  /** --color-brand-accent: the one accent colour, used for data. */
  accent: '#a8324e',
  /** --color-accent-deep: hover/pressed on crimson, darker end of bar gradients. */
  accentDeep: '#8f2943',
  /** --color-accent-soft: wash for bands and selection. */
  accentSoft: '#f7e9ec',
  /** --color-ink: strong text. */
  ink: '#1b1b1d',
  /** --color-ink-soft: axis labels, secondary text. */
  inkSoft: '#57534e',
  /** --color-paper: page background, quiet inset surfaces. */
  paper: '#faf7f2',
  /** --color-surface: tooltip and card background. */
  surface: '#ffffff',
  /** --color-line: hairline grid and rules. */
  line: '#e7e2d8',
  /** --color-line-strong: hover border, tooltip cursor. */
  lineStrong: '#d9d2c5',
  /** Tooltip card surface/border (same warm pair as `surface`/`line`). */
  tooltipBg: '#ffffff',
  tooltipBorder: '#e7e2d8',
} as const;

/**
 * Recharts axis props: no axis lines, no tick marks, 11 px ink-soft labels.
 * Spread onto any <XAxis /> or <YAxis /> and override `width` / `minTickGap`.
 */
export const axisProps = {
  tickLine: false,
  axisLine: false,
  stroke: CHART.line,
  tick: { fill: CHART.inkSoft, fontSize: 11 },
  tickMargin: 8,
} as const;

/**
 * Horizontal dashed hairlines only — a warm ledger rule, never a box.
 * Spread onto <CartesianGrid />.
 */
export const gridProps = {
  horizontal: true,
  vertical: false,
  stroke: CHART.line,
  strokeDasharray: '3 4',
} as const;

/**
 * Tooltip styling. `card` / `label` / `value` / `note` are Tailwind class names for
 * custom tooltips; `cursor`, `contentStyle`, `labelStyle` and `itemStyle` are the
 * matching props for the default Recharts <Tooltip />.
 */
export const tooltip = {
  card: 'rounded-control border border-line bg-surface px-3 py-2 text-xs text-ink shadow-card',
  label: 'font-semibold text-ink',
  value: 'text-ink-soft',
  note: 'mt-1 text-[11px] text-ink-soft',
  cursor: { stroke: CHART.lineStrong, strokeDasharray: '3 3' },
  contentStyle: {
    borderRadius: '0.625rem',
    border: `1px solid ${CHART.tooltipBorder}`,
    background: CHART.tooltipBg,
    boxShadow: '0 10px 30px -22px rgb(27 27 29 / 0.35)',
    padding: '0.5rem 0.75rem',
    fontSize: 12,
    color: CHART.ink,
  },
  labelStyle: { color: CHART.ink, fontWeight: 600 },
  itemStyle: { color: CHART.inkSoft },
} as const;

const numberFormat = new Intl.NumberFormat('de-CH');

/** Swiss number formatting for charts and their text alternatives: 12'345. */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '–';
  return numberFormat.format(value);
}

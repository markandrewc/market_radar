# Market Radar — design language (UI 3.0)

The product should read like a **data magazine**: warm paper, graphite ink, crimson only where data or an action
needs attention. The people using it are programme staff, not analysts — calm typography and clear hierarchy beat
decoration.

## Principles

1. **One accent, used sparingly.** Crimson marks data, an active state or a primary action. Everything else is
   ink on paper.
2. **Type does the work.** Large, tight headlines; small uppercase kickers; generous line length limits; numbers
   in tabular figures.
3. **Surfaces, not boxes.** Cards have a warm hairline and one soft shadow; hover lift only where something is
   clickable. Sections can be open (rules and whitespace) instead of another card.
4. **Provenance stays visible.** Source pills and "our reading" panels keep their hierarchy; the refresh never
   hides a citation or a disclaimer.
5. **Quiet motion.** 200 ms fades/lifts, `prefers-reduced-motion` always wins.
6. **Light only.** No dark mode in this increment (documented decision).

## Tokens (`src/web/index.css`)

| Token | Value | Use |
|---|---|---|
| `--color-ink` | `#1b1b1d` | body text, headlines |
| `--color-ink-soft` | `#57534e` | secondary text |
| `--color-paper` | `#faf7f2` | page background |
| `--color-surface` | `#ffffff` | cards, dialogs |
| `--color-line` | `#e7e2d8` | hairlines, table rules |
| `--color-line-strong` | `#d9d2c5` | hover borders |
| `--color-brand` | `#2f2f31` | legacy alias (logo graphite) |
| `--color-brand-accent` | `#a8324e` | crimson: data, CTA, active |
| `--color-accent-deep` | `#8f2943` | hover on crimson |
| `--color-accent-soft` | `#f7e9ec` | selection, soft badges |
| `--radius-card` | `1rem` | cards, panels |
| `--radius-control` | `0.625rem` | buttons, inputs, pills |
| `--shadow-card` | subtle | resting cards |
| `--shadow-lift` | stronger | interactive hover |
| `--shadow-float` | deepest | hero stat card, popovers |

Typography: **Inter Variable**, self-hosted via `@fontsource-variable/inter` (no Google requests). Fallback is the
system UI stack. Body 15–16 px / 1.6; H1 40–48 px; H2 24–28 px; kicker 11 px / 650 / 0.16 em tracking; numbers
`tabular-nums`.

Component classes: `.kicker`, `.display`, `.tnum`, `.rule`, `.paper-dots`, `.hero-glow`, `.card-lift`.

## Type scale

| Role | Class | Notes |
|---|---|---|
| Page kicker | `.kicker` | e.g. `MARKET RADAR`, `POLICY WATCH` |
| Page headline (h1) | `text-4xl sm:text-5xl display` | one per page |
| Section (h2) | `text-2xl sm:text-3xl font-semibold tracking-tight` | via `SectionHeader` |
| Card title (h3) | `text-base sm:text-lg font-semibold` | never larger than h2 |
| Lede | `text-base sm:text-lg text-ink-soft max-w-3xl` | one per page |
| Body | `text-[15px] leading-relaxed text-ink` | |
| Meta / source | `text-xs text-ink-soft` | citations stay readable (≥ 12 px) |

## Components

- **PageHeader**: kicker → h1 → lede → optional actions → hairline. Sets the document title.
- **SectionHeader**: kicker, h2, description, optional "View all" link; used by every content section.
- **Card**: white surface, `rounded-card`, warm hairline, `shadow-card`; `interactive` adds `card-lift`.
- **Button**: control radius, medium weight; primary crimson with a deep hover; outline on paper; ghost with
  underline. Focus ring from `:focus-visible`.
- **Badge**: pill, optional status dot; soft variants use dark text on a tint (never tint-on-tint).
- **Tabs / Segmented**: paper track, ink active state, 2 px crimson underline for tabs.
- **Table**: warm header, hairline rows, hover row, `tnum` for numbers; always inside a scroll container.
- **KpiCard**: icon chip, large number, signed delta pill, detail, source pill.
- **ChartFrame**: header (kicker/title/description/filters), chart on a paper-soft inset, interpretation panel,
  "Show numbers" table, source row.
- **Interpretation**: paper-warm panel, 3 px crimson rail, compass badge, kicker "What this means for
  Powercoders", evidence chips.
- **SourceInfo / SourceBadge**: quiet pill with a dot and an external-link icon; popover on paper with publisher
  date, retrieval date, note and the original link.
- **Explain**: same family as Interpretation; AI tag, sentence citations, disclaimer, data-based fallback.
- **Empty / Error / Loading**: icon + one actionable sentence; skeletons in warm tones.

## Page rules

- Home: dark graphite hero with crimson glow and a floating "This week in numbers" card (live `overview`), then
  open editorial sections separated by hairlines.
- Every list page: kicker + headline + lede, then filters as pills, then content; pagination quiet.
- Charts never start without an explanation panel and a source line.
- Nothing may rely on colour alone; every delta has a sign and text.

## Accessibility

- Text contrast ≥ 4.5:1 (crimson `#a8324e` on white ≈ 5.7:1; on paper similar). Kickers only at ≥ 11 px / 650.
- Focus ring 3 px crimson with 3 px offset on paper.
- Reduced motion respected globally and in `.card-lift`.
- `axe` must stay clean on every page; tables keep captions; charts keep `role="img"` labels.

## Visual acceptance checklist

- [ ] Inter is loaded from the bundle (no request to fonts.googleapis.com).
- [ ] 360 / 768 / 1280 px: no horizontal scroll; nav sheet works on mobile; tables scroll.
- [ ] One h1 per page, no skipped heading levels; kickers are consistent.
- [ ] Cards share radius, hairline and shadow; only interactive cards lift on hover.
- [ ] Charts use the theme (crimson line, gradient area, dashed horizontal grid, warm tooltip).
- [ ] Source pill + popover readable; dates and licences present.
- [ ] Empty, loading and error states look intentional.
- [ ] `npm run typecheck`, `npx vitest run`, `VITE_USE_MOCKS=0 npm run build` green.

## Do not

- No second accent colour, no gradients on text, no glassmorphism on content cards.
- No new UI or chart libraries, no dark mode, no serif display face (decision: Inter only).
- Do not change copy, data, provenance or test contracts as part of the visual refresh.

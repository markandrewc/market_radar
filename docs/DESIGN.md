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

Typography: **Inter Variable** for text and numbers, **Plus Jakarta Sans Variable** for display headlines —
both self-hosted (`@fontsource-variable/inter`, `@fontsource-variable/plus-jakarta-sans`, no Google requests).
Fallback is the system UI stack. Body 15–16 px / 1.6; H1 40–48 px; H2 24–28 px; kicker 11 px / 650 / 0.16 em
tracking; numbers `tabular-nums`.

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

## Information architecture (Level 1–4)

The header carries the challenge structure as four level tabs (`LevelTabs`), so a coach always knows which
question a page answers. Existing routes stay reachable.

| Level | Tab | Routes | Question |
|---|---|---|---|
| 1 | Market & skills | `/`, `/roles`, `/roles/:id` | A demand, B skills |
| 2 | Weekly briefing | `/reports` | regular plain-language digest |
| 3 | People, employers & policy | `/context` (hub), `/policy`, `/participants` | C employers, D target group, E policy |
| 4 | Data sources | `/sources`, `/items` | provenance, health, adding sources |

`/context` is a hub: policy, target group and employers as three linked cards with real counts. Employers stay an
honest empty state until Adzuna keys exist — never sample companies.

## What we took from the "Swiss Humanitarian Clarity" references

The references (Google Stitch, Material 3) contributed structure, not palette. The warm editorial palette and
Crimson stay; Plus Jakarta Sans was added for display headlines.

| Reference idea | Decision | Why |
|---|---|---|
| Level 1–4 tab navigation | adopted | makes the challenge structure visible |
| "Question A/B" section framing | adopted | ties every chart to the challenge |
| Two-column answer layout, card provenance footers | adopted | scanability + visible sources |
| Mail-client preview frame | adopted | shows Level 2 as the real artefact |
| Feed cards, health counts, add-source wizard | adopted | Level 4 becomes usable without a terminal |
| Teal/cool-blue palette, Material Symbols, Google Fonts | **rejected** | brand and privacy: warm paper + Crimson, lucide, self-hosted fonts |
| 14,820 vacancies, ESCO IDs, momentum index, latency/uptime, ISO/FADP seals, recipient groups, bi-weekly cadence | **rejected** | not in our data or not provable; replaced by real fields or honest empty states |

## Page rules

- Home: dark graphite hero with crimson glow and a floating "This week in numbers" card (live `overview`), then
  open editorial sections separated by hairlines.
- Every list page: kicker + headline + lede, then filters as pills, then content; pagination quiet.
- Charts never start without an explanation panel and a source line.
- Nothing may rely on colour alone; every delta has a sign and text.

## Guided tour

The tour is a spotlight over the real interface (`src/web/tour/`), not a text dialog. `TourProvider` holds the
state, `TourOverlay` dims the page except the current target and positions a small card next to it.

- Steps live in `tour/steps.ts`: Quick (5) covers the levels, pulse, the role filter and a source; Full (10) adds
  the Level 3 hub, the briefing preview and the data-source wizard.
- Targets are marked with `data-tour="…"` on the real elements (levels, sync chip, pulse, role filter, chart
  source footer, context cards, detail page header, report preview, feeds, wizard). No CSS-selector guessing.
- Two steps are practical: the role filter and a Level 3 card advance when the visitor actually clicks; "Skip
  this step" still moves on.
- Keyboard: Esc ends the tour, arrow keys move between steps; the card takes focus on each step and focus returns
  to the opener. The overlay is deliberately not modal so practice targets stay clickable.
- The first-visit prompt is offered once per `TOUR_VERSION` (`mr-tour-seen`); the HelpDialog is the chooser.
- If a target is missing (empty data, page not ready), the card shows centred with a short note instead of failing.

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

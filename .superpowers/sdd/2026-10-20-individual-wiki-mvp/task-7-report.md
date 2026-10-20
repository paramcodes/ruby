# Task 7 report: Design tokens

## Status

Complete. All requested verification commands pass. Home page restyled through CSS
only; `src/app/page.tsx` untouched.

## Files changed

- `src/styles/tokens.css` (new)
- `src/styles/globals.css` (rewritten styling, reset extended)
- `src/app/layout.tsx` (viewport export; global stylesheet import unchanged)

## Token inventory

All tokens live on `:root` in `src/styles/tokens.css` with
`color-scheme: light dark`.

### Color (all values `oklch()`)

Warm neutrals use hue 78-80 with low chroma (0.005-0.012). Grays that need no hue
use `none`.

| Token | Definition |
| --- | --- |
| `--color-canvas` | `light-dark(oklch(98.4% 0.005 80), oklch(21% 0.008 78))` |
| `--color-surface` | `light-dark(oklch(94.6% 0.008 80), oklch(27% 0.009 78))` |
| `--color-surface-raised` | `light-dark(oklch(100% 0 none), oklch(33% 0.01 78))` |
| `--color-surface-sunken` | `light-dark(oklch(92% 0.012 80), oklch(13% 0.007 78))` |
| `--color-text` | `light-dark(oklch(24% 0.012 75), oklch(92% 0.008 80))` |
| `--color-text-muted` | `light-dark(oklch(44% 0.012 75), oklch(76% 0.01 80))` |
| `--color-text-subtle` | `light-dark(oklch(50% 0.01 75), oklch(71% 0.01 80))` |
| `--color-border` | `color-mix(in oklch, var(--color-text) 14%, var(--color-canvas))` |
| `--color-border-strong` | `color-mix(in oklch, var(--color-text) 28%, var(--color-canvas))` |
| `--color-border-interactive` | `color-mix(in oklch, var(--color-text) 58%, var(--color-canvas))` |
| `--color-accent` | `light-dark(oklch(45% 0.08 168), oklch(76% 0.09 168))` |
| `--color-accent-hover` | `color-mix(in oklch, var(--color-accent) 88%, var(--color-text))` |
| `--color-accent-subtle` | `color-mix(in oklab, var(--color-accent) 30%, var(--color-canvas))` |
| `--color-selection` | `oklch(64% 0.1 168)` |
| `--color-selection-text` | `oklch(22% 0.015 168)` |
| `--color-danger` | `light-dark(oklch(48% 0.17 25), oklch(72% 0.14 25))` |
| `--color-shadow` | `light-dark(oklch(24% 0.012 75), oklch(0% 0 none))` |

No hex, `rgb()`, `rgba()`, or hardcoded alpha colors in the token file. Hover and
tint variants are derived with `color-mix(in oklch, ...)`; `--color-accent-subtle`
uses `oklab` so the hue stays green instead of drifting olive.

### Typography

| Token | Value |
| --- | --- |
| `--font-reading` | `"Iowan Old Style", "Charter", "Bitstream Charter", "Source Serif 4", Georgia, serif` |
| `--font-display` | `var(--font-reading)` |
| `--font-ui` | `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` |
| `--font-size-small` | `clamp(0.8125rem, 0.785rem + 0.15vw, 0.875rem)` |
| `--font-size-body` | `clamp(1rem, 0.96rem + 0.2vw, 1.125rem)` |
| `--font-size-large` | `clamp(1.125rem, 1.05rem + 0.35vw, 1.375rem)` |
| `--font-size-title` | `clamp(1.75rem, 1.3rem + 2vw, 2.75rem)` |
| `--font-size-display` | `clamp(2.25rem, 1.4rem + 3.6vw, 4rem)` |
| `--line-height-tight` | `1.08` |
| `--line-height-snug` | `1.3` |
| `--line-height-body` | `1.6` |
| `--line-height-relaxed` | `1.7` |
| `--font-weight-medium` | `500` |
| `--letter-spacing-title` | `-0.015em` |
| `--text-underline-offset` | `0.18em` |
| `--measure` | `68ch` |
| `--measure-heading` | `16ch` |
| `--measure-lead` | `52ch` |

Every growing size is `rem + vw` (no bare `vw`). Largest max/min ratio is the
display size: 4 / 2.25 = 1.78, below the 2.5 limit.

### Spacing

`--space-3xs` 0.25rem, `--space-2xs` 0.5rem, `--space-xs` 0.75rem,
`--space-sm` 1rem, `--space-md` 1.5rem, `--space-lg` 2rem, `--space-xl` 3rem,
`--space-2xl` 4.5rem, `--space-section` `clamp(4rem, 2.5rem + 7vw, 8.5rem)`
(ratio 2.125).

### Border, focus, motion, elevation

- `--border-width` 1px, `--border-width-strong` 2px
- `--radius-small` 0.25rem, `--radius-medium` 0.375rem, `--radius-large` 0.5rem
- `--focus-ring-width` 2px, `--focus-ring-color` `var(--color-accent)`,
  `--focus-ring-offset` 3px
- `--duration-fast` 120ms, `--duration-base` 200ms,
  `--ease-standard` `cubic-bezier(0.2, 0, 0, 1)`
- `--shadow-raised` (1px/2px, shadow token at 6%),
  `--shadow-overlay` (2px/4px plus 16px/40px, shadow token at 6% and 10%).
  Two subtle shadows; nothing else lifts.

## globals.css changes

- `@import "./tokens.css";` at the top.
- Kept the reset: `box-sizing: border-box`, `min-inline-size: 0` on the universal
  selector.
- Base rules added: body margin 0 and `min-block-size: 100svh`; balanced headings;
  block-level media with `max-inline-size: 100%`; `font: inherit` plus
  `font-size: max(1rem, 1em)` on form controls; `touch-action: manipulation` on
  controls; `user-select: none` on buttons only; `scrollbar-gutter: stable` on
  html; `text-wrap: pretty` on body (inherited) with `balance` on headings.
- Tokens replace every hardcoded value.
- Removed the radial-gradient wash. Body is flat `--color-canvas`.
- `.home__eyebrow` is now a quiet small sans label: `--font-ui`,
  `--font-size-small`, weight 500, `letter-spacing: 0`, `text-transform: none`,
  accent color.
- Reading text uses `--font-reading`; UI labels use `--font-ui`.
- `.home__intro` is no longer a card: no border, radius, background, or shadow.
  It is an unboxed editorial column with token spacing.
- Home measures `--measure` (68ch), title capped at 16ch, display type at
  `--font-size-display`, description at `--font-size-large` with muted text.
- `:focus-visible` uses the focus tokens with a positive offset; no
  `outline: none` anywhere.
- The only hover rule is inside `@media (hover: hover) and (pointer: fine)`.
- The only transition is inside `@media (prefers-reduced-motion: no-preference)`,
  names `color`, and uses `--ease-standard` (no `ease-in`).
- `overflow: clip` on `.home`.

## layout.tsx changes

- Import type widened to `Metadata, Viewport`.
- Added `export const viewport: Viewport = { colorScheme: "light dark" };`.
- `lang="en"`, metadata, and the `../styles/globals.css` import are unchanged.

## Verification

Run from `/home/param/.codex/worktrees/54db/ruby`:

| Command | Result |
| --- | --- |
| `pnpm format:check` | `All matched files use Prettier code style!` |
| `pnpm lint` | Pass, no findings (`eslint .` exited 0) |
| `pnpm typecheck` | Pass, no errors (`tsc --noEmit` exited 0) |
| `pnpm build` | Pass; compiled in 4.2s; 6 routes generated |

`pnpm build` route table: `/` static, `/_not-found` static, `/api/auth/[...all]`
dynamic, `/dashboard` dynamic, `/sign-in` static, `/sign-up` static.

### Contrast (computed from the token values, sRGB WCAG ratio)

Convention for every ratio in this report: OKLCH -> OKLab -> linear sRGB with
no intermediate 8-bit quantization, WCAG relative luminance, rounded half-up to
two decimals; OKLCH lightness is quoted to one decimal. Tables keep the token
values of their round; where a later round changed a token, the superseded rows
are marked.

| Pair | Light | Dark |
| --- | --- | --- |
| text / canvas | 15.72:1 | 13.98:1 |
| text-muted / canvas | 7.43:1 | 8.25:1 |
| accent / canvas | 6.81:1 | 8.59:1 |

Body text and muted text both clear 4.5:1 in both themes.

### Browser check

Installed Playwright Chromium 1.64.1 captured the home page at 1280x800 in both
color schemes from `next start` on port 3010.

- Light: near-white warm canvas, deep green small sans label, large serif
  heading, muted serif description, generous whitespace, no card, no gradient.
- Dark: warm near-black canvas with the same hierarchy and a lighter green label.
- Computed styles confirmed `--font-reading` on the title, `--font-ui` on the
  eyebrow, `color-scheme: light dark` on body, 64px display title at this
  viewport, and 21.28px description.
- Result reads calm and editorial in both schemes.

## Decisions

- One `:root` block with `light-dark()` per color token. Derived border, hover,
  and tint tokens reference semantic tokens through `color-mix`, so no theme
  value is duplicated and a new theme only needs the base pairs.
- Accent stays at the requested archival green (`oklch(45% 0.08 168)` in light).
  Dark mode lifts it to `oklch(76% 0.09 168)` to keep accent text above 6:1
  against the dark canvas while preserving the hue.
- Surfaces stay flat on the home page. `--color-surface*`, radius, and shadow
  tokens exist for later navigation, menus, and dialogs, not for a card grid.
- `--shadow-raised` is deliberately faint; real raised states use
  `--shadow-overlay`, and most surfaces should use none.
- The token file avoids physical direction words and the stylesheet uses
  `inline`/`block` properties throughout.
- `--font-display` aliases the reading serif. The product needs one serif, not a
  second decorative display face; this keeps hierarchy from type size and
  spacing instead.

## Concerns

- `light-dark()` and `color-mix(in oklch, ...)` require a modern browser
  (roughly Chrome 123+, Safari 17.5+, Firefox 120+). This is acceptable for the
  MVP target and is the cost of one token set for both themes.
- `"Iowan Old Style"` only resolves on macOS. Linux and Windows fall back to
  Charter/Georgia per the stack; the captured Linux screenshot still reads as a
  serif editorial page, but letterforms differ by platform.
- No component layer exists yet, so most tokens (`surface*`, radius, shadows,
  motion, danger) are defined but not consumed. Task 8+ should consume them
  rather than introduce new values.
- `.home__intro` no longer has a visible container. If the next task adds
  navigation or actions, it must create hierarchy through spacing and type, not
  by restoring the removed card treatment.

## Fix report: Task 7 review findings

> **Superseded in part by round 2.** The selection bullet (finding 1) and the
> 45% interactive-border bullet (finding 3) below record round-1 values that no
> longer exist in `tokens.css`. Current token values live in the inventory table
> above; current selection and border numbers live in "Fix report: contrast
> tuning (second review round)". Read this section as history only.

### Status

Complete. All five findings and the cheap cleanups are addressed. Tokens,
`::selection`, and the build pipeline changed; no component or test changed.

### Findings addressed

1. **Accent tint and selection.** (Historical: the selection values here were
   replaced in round 2 — see the selection row in "Fix report: contrast tuning
   (second review round)".) `--color-accent-subtle` now mixes 30% accent
   into `--color-canvas` in `oklab`, producing `#b9cac0` at hue 159.7 in light
   and `#35463b` at hue 156.3 in dark (1.63:1 and 1.76:1 against canvas). The
   mix space is deliberate: `oklch` interpolation still drags the hue toward the
   warm canvas (about 106°, olive), while `oklab` keeps it green. `::selection`
   no longer uses the tint. A dedicated
   `--color-selection: light-dark(oklch(68% 0.1 168), oklch(40% 0.08 168))`
   resolves to `#51ac8c` (2.62:1 vs canvas, 5.99:1 for text) in light and
   `#02553f` (2.01:1 vs canvas, 6.97:1 for text) in dark.

2. **Shadow ink.** Added
   `--color-shadow: light-dark(oklch(24% 0.012 75), oklch(0% 0 none))`.
   `--shadow-raised` and `--shadow-overlay` now mix that token in `oklab` at the
   same 6% and 10% weights. Light shadows use warm dark ink; dark shadows use
   black, so text color can no longer turn them into a white glow.

3. **Interactive borders.** (Historical: the 45% mix and its numbers were
   replaced in round 2 by the 58% mix.) Added `--color-border-interactive` as a
   45% text/canvas mix: 3.10:1 in light and 3.35:1 in dark, clearing WCAG 1.4.11
   for input and button boundaries. `--color-border` (1.37:1) and
   `--color-border-strong` (1.94:1 light, 2.00:1 dark) remain for decorative
   separators, and a token comment states the split.

4. **Build pipeline.** Added the `browserslist` field to `package.json` with
   `chrome 123`, `edge 123`, `firefox 120`, and `safari 17.5`. Browserslist
   resolves exactly those four targets. Rebuilt CSS now keeps `light-dark()`:
   the emitted stylesheet contains 11 `light-dark` occurrences, zero
   `prefers-color-scheme` blocks, and zero `--lightningcss-*` fallback custom
   properties. A Playwright run against `next start` on port 3011 confirmed the
   tokens respond to `color-scheme` on `<html>`:
   - forced `color-scheme: light`: body background `oklch(0.984 0.005 80)`,
     body color `oklch(0.24 0.012 75)`.
   - forced `color-scheme: dark`: body background `oklch(0.21 0.008 78)`,
     body color `oklch(0.92 0.008 80)`.
   - default (no override): light values, matching the headless browser's
     light preference.

5. **Surface ramp.** Chose to widen the ramp rather than document close values
   only. Surface tokens also carry a comment to pair them with a border when the
   boundary is load-bearing.

   These are round-1 values. Round 2 lifted light sunken from 88% to 92%, which
   supersedes the two sunken rows: current light sunken is 1.21:1 from canvas
   and 1.08:1 from surface. Dark sunken did not change.

   | Pair | Light | Dark |
   | --- | --- | --- |
   | surface / canvas | 1.12:1 | 1.18:1 |
   | raised / canvas | 1.05:1 | 1.45:1 |
   | sunken / canvas | 1.37:1 | 1.14:1 |
   | raised / surface | 1.17:1 | 1.23:1 |
   | sunken / surface | 1.23:1 | 1.33:1 |

   Light `raised` is white, so its ceiling against the near-white canvas is
   1.05:1; it separates from `surface` at 1.17:1 and should carry a border where
   the edge matters.

### Cheap cleanups

- Removed the two-hop focus alias. `--color-focus-ring` is gone and
  `--focus-ring-color` now references `--color-accent` directly.
- Moved `font-weight: 500` to `--font-weight-medium`,
  `letter-spacing: -0.015em` to `--letter-spacing-title`, and the 16ch / 52ch
  measures to `--measure-heading` and `--measure-lead`.
- Scoped the reset: `img`, `picture`, `video`, and `canvas` are block-level;
  `svg` keeps only `max-inline-size: 100%` so inline icons stay in text flow.
- Removed `overflow: clip` from `.home`; nothing overflowed it.
- Added a comment on `max(1rem, 1em)` explaining the iOS Safari zoom-on-focus
  intent.

### Verification

| Command | Result |
| --- | --- |
| `pnpm format:check` | Pass, `All matched files use Prettier code style!` |
| `pnpm lint` | Pass, no findings |
| `pnpm typecheck` | Pass, no errors |
| `pnpm build` | Pass, Next.js 16.4.2, 6 routes generated |
| Built CSS check | 11 `light-dark()`, 0 `prefers-color-scheme`, 0 `--lightningcss-*` |
| Manual `color-scheme` override | Light and dark token values switch as expected |

### Concerns

- A black shadow in dark mode is nearly invisible on the dark canvas. That is
  the intended trade against a white glow, but dark elevation now relies on
  surface steps and borders rather than shadow.
- The browserslist floor is now explicitly Chrome/Edge 123, Firefox 120, and
  Safari 17.5. This matches what `light-dark()` and `color-mix()` already
  require, but older browsers get no theme fallback at all.
- `--color-accent-subtle` at 30% is still a low-contrast tint (1.63:1 light).
  It is for background washes only; selection has its own stronger token.

## Fix report: contrast tuning (second review round)

### Status

Complete. Three contrast findings fixed by changing token values and comments
only; the token file structure is unchanged. `::selection` now uses a dedicated
label token, the underline offset moved into `--text-underline-offset`, and the
inventory tables above now match `tokens.css`.

### Findings addressed

1. **Interactive border mix raised 45% -> 58%.** The 45% mix measured 3.10:1 on
   canvas but only 2.79:1 on light surface and 2.26:1 on light sunken, so the old
   "meets WCAG 1.4.11" comment was false for controls drawn inside those
   surfaces. At 58% every surface in both themes clears 3:1; the tightest pair is
   dark raised at 3.38:1. The comment now states the measured floor and warns
   against non-token fills.

2. **Light sunken lifted 88% -> 92%, light subtle text 52% -> 50%.** At 88%
   sunken, `--color-text-subtle` was 3.86:1 and the interactive border 2.26:1.
   Light sunken now sits at 92% and text-subtle at 50%, giving 4.74:1 for subtle
   text and 3.79:1 for the interactive border. Muted (6.14:1) and body
   (12.95:1) text also clear. A comment records that sunken is now only 1.08:1
   from surface, so a recess needs an edge as well as the tone.

   Text-subtle moved because lifting sunken alone would have needed 94%+, which
   sits within 0.6% lightness of surface and erases the ramp.

3. **Selection reworked, `--color-selection-text` added.** Dark
   `--color-selection` was oklch(40% 0.08 168), 2.01:1 on dark canvas and 1.38:1
   on dark raised. Both themes now share one light accent tint,
   `oklch(64% 0.1 168)`, with a dark ink label `oklch(22% 0.015 168)` instead of
   `--color-text`. Dark canvas visibility goes 2.01 -> 5.53:1 and dark raised
   1.38 -> 3.82:1; selected text stays at 5.38:1. The old approach cannot be
   rescued by lifting a dark tint alone: dark raised is oklch(33%), so any tint
   dark enough to keep light text at 4.5:1 lands near 2:1 on raised (measured
   2.05:1 at the 4.5:1 boundary).

4. **Underline offset tokenized.** `--text-underline-offset: 0.18em` joins the
   typography block; `globals.css` links use `var(--text-underline-offset)`.

5. **Inventory refreshed.** Surface, sunken, subtle, accent-subtle, selection,
   shadow, and border-interactive rows now match the file; the stale
   `--color-focus-ring` row is gone and `--focus-ring-color` is documented as
   referencing `--color-accent` directly.

### Measured contrast after the fix

Method: each `oklch()` and `color-mix(in oklch, ...)` value converted to OKLab,
then linear sRGB with no intermediate 8-bit quantization; ratio computed from
WCAG relative luminance and rounded half-up to two decimals, matching the
convention stated above. The accuracy pass at the end of this report recomputed
these round-2 rows under the same convention.

Resolved colors:

| Token | Light | Dark |
| --- | --- | --- |
| canvas | `#fbf9f6` | `#1a1814` |
| surface | `#f0ede7` | `#292622` |
| raised | `#ffffff` | `#383530` |
| sunken | `#e9e4dc` | `#090705` |
| text | `#231f19` | `#e7e4df` |
| text-muted | `#56524b` | `#b4b0aa` |
| text-subtle | `#67635d` | `#95928b` |
| border-interactive | `#75726c` | `#898681` |
| selection | `#44a080` | `#44a080` |
| selection-text | `#141d19` | `#141d19` |

Interactive border (1.4.11, 3:1 required):

| Background | Light | Dark |
| --- | --- | --- |
| canvas | 4.59:1 | 4.90:1 |
| surface | 4.10:1 | 4.17:1 |
| raised | 4.81:1 | 3.38:1 |
| sunken | 3.79:1 | 5.56:1 |

Sunken text (4.5:1 required):

| Pair | Light | Dark |
| --- | --- | --- |
| text / sunken | 12.95:1 | 15.86:1 |
| muted / sunken | 6.14:1 | 9.32:1 |
| subtle / sunken | 4.74:1 | 6.46:1 |

Subtle text on the other surfaces (light): canvas 5.73:1, surface 5.13:1,
raised 6.01:1. Dark: canvas 5.69:1, surface 4.84:1, raised 3.93:1 (pre-round-3
values; the round-3 fix report below replaces them).

Selection (background vs surface, 3:1 target for visibility):

| Background | Light | Dark |
| --- | --- | --- |
| canvas | 3.06:1 | 5.53:1 |
| surface | 2.73:1 | 4.71:1 |
| raised | 3.20:1 | 3.82:1 |
| sunken | 2.53:1 | 6.28:1 |
| selection-text / selection | 5.38:1 | 5.38:1 |

Surface ramp after the change: light surface/canvas 1.12:1, raised/canvas
1.05:1, sunken/canvas 1.21:1, raised/surface 1.17:1, sunken/surface 1.08:1.
Dark: 1.18, 1.45, 1.14, 1.23, 1.33. Decorative separators stay at 1.37:1
(light) and 1.34:1 (dark); border-strong at 1.94:1 and 2.00:1.

### Verification

| Command | Result |
| --- | --- |
| `pnpm format:check` | Pass, `All matched files use Prettier code style!` |
| `pnpm lint` | Pass, no findings (`eslint .` exited 0) |
| `pnpm typecheck` | Pass, no errors (`tsc --noEmit` exited 0) |
| `pnpm build` | Pass, Next.js 16.4.2, compiled in 3.5s, 6 routes |
| Built CSS check | `--color-selection`, `--color-selection-text`, and `--text-underline-offset` present; `a` uses `var(--text-underline-offset)` |

### Concerns

- Dark `--color-text-subtle` on dark raised measured 3.93:1 at this point, below
  4.5:1. It was left unchanged here; the round-3 fix report below raises dark
  subtle to `oklch(71% 0.01 80)` and clears the floor.
- Light selection on surface (2.73:1) and sunken (2.53:1) is a softer highlight
  than on canvas. The label still clears 5.38:1. Getting 3:1 on those near-white
  surfaces would require a dark tint that pushes dark ink below 4.5:1.
- Light sunken is now 1.08:1 from surface, so the recess is mostly carried by
  the edge, not the tone. Dark sunken keeps a 1.33:1 step.
- The interactive border floor is 3.38:1 on dark raised. A future control drawn
  on a bespoke fill lighter than `--color-surface-raised` needs its own check.


## Fix report: dark subtle contrast gap (third review round)

### Status

Complete. One unconsumed token changed; no component, test, or other token
changed. `--color-text-subtle` in the dark theme moved from
`oklch(66% 0.01 80)` to `oklch(71% 0.01 80)`, which puts it above WCAG AA 4.5:1
on every surface. A comment in `tokens.css` records the floor and the tightest
pair. This section also marks the superseded round-1 values in this report.

### Change

| Token | Before | After |
| --- | --- | --- |
| `--color-text-subtle` (dark) | `oklch(66% 0.01 80)`, `#95928b` | `oklch(71% 0.01 80)`, `#a5a19b` |

The light value stays `oklch(50% 0.01 75)`. Dark raised is `oklch(33% 0.01 78)`,
the lightest dark surface, so it sets the floor. The 4.5:1 crossing there is
69.6%; 71% keeps 1.4 lightness points of deliberate headroom and measures
4.75:1. The token remains below dark `--color-text-muted` (`oklch(76% 0.01 80)`)
so the two tiers stay distinct.

### Measured contrast after the fix

Method: `oklch()` converted to OKLab, then linear sRGB with no intermediate
8-bit quantization; WCAG relative luminance, ratios rounded half-up to two
decimals. The accuracy pass below recomputed the round-2 rows under the same
convention, so both sections now quote identical ratios for unchanged tokens.

Subtle text (4.5:1 required, small captions):

| Background | Light | Dark |
| --- | --- | --- |
| canvas | 5.73:1 | 6.88:1 |
| surface | 5.13:1 | 5.85:1 |
| raised | 6.01:1 | 4.75:1 |
| sunken | 4.74:1 | 7.81:1 |

Muted text, unchanged, for reference:

| Background | Light | Dark |
| --- | --- | --- |
| canvas | 7.43:1 | 8.25:1 |
| surface | 6.64:1 | 7.02:1 |
| raised | 7.78:1 | 5.69:1 |
| sunken | 6.14:1 | 9.37:1 |

Separation from `--color-text-muted`: light subtle vs muted 1.29:1 (50% vs 44%
lightness); dark 1.20:1 (71% vs 76%). Subtle is the weaker tier in both themes
and no pair collapses onto the other, although the dark gap narrowed from 1.45:1
to 1.20:1.

Both themes now clear the floor everywhere; the tightest pair in the whole set is
dark raised at 4.75:1.

### Report reconciliation

- The round-1 "Accent tint and selection" and "Interactive borders" bullets are
  marked historical; round 2 replaced those tokens.
- The token inventory row for `--color-text-subtle` now matches `tokens.css`.
- The round-2 note that dark subtle on raised measured 3.93:1 is marked as a
  pre-round-3 measurement.

### Verification

| Command | Result |
| --- | --- |
| `pnpm format:check` | Pass, `All matched files use Prettier code style!` |
| `pnpm lint` | Pass, no findings (`eslint .` exited 0) |
| `pnpm typecheck` | Pass, no errors (`tsc --noEmit` exited 0) |
| `pnpm build` | Pass, Next.js 16.4.2, compiled in 6.6s, 6 routes |

Built CSS keeps `light-dark()` and the new value:
`--color-text-subtle:light-dark(oklch(50% .01 75), oklch(71% .01 80))`.
A Playwright Chromium run against that stylesheet resolved the computed color to
`oklch(0.5 0.01 75)` with `color-scheme: light` and `oklch(0.71 0.01 80)` with
`color-scheme: dark`.

Commit: `0a696de fix: close Task 7 dark subtle contrast gap` (`tokens.css` only;
`.superpowers/sdd/` is gitignored, so this report is not committed).

### Concerns

- The dark subtle/muted gap is now 5 OKLCH lightness points. It is visible, but
  readers on low-quality panels may see the two tiers as close.
- Any future change to dark `--color-surface-raised` invalidates the 71% value;
  the token comment says so, but nothing enforces it in CI.

## Fix report: comment and report accuracy pass (fourth pass)

### Status

Complete. Comments and report text only; no token value changed and no
component or test touched. Four token comments were corrected (subtle text,
accent tint, selection, interactive border), a method note was added, and this
report was reconciled to one contrast convention.

### Changes

1. **Dark subtle headroom (`tokens.css`).** The comment claimed 71% was "the
   lowest lightness that clears the floor". The measured 4.5:1 crossing on dark
   raised (`oklch(33% 0.01 78)`) is 69.6%, so 71% carries 1.4 lightness points
   of deliberate headroom and measures 4.75:1 there. Light's tightest pair stays
   sunken at 4.74:1, 0.24 above the floor.
2. **Accent tint is body-text only (`tokens.css`).** `--color-text-subtle` on
   `--color-accent-subtle` measures 3.52:1 in light and 3.92:1 in dark, below
   AA, so the comment now limits the tint to body text (9.65:1 light, 7.96:1
   dark).
3. **Selection label (`tokens.css`).** The comment now states that
   `--color-text` on `--color-selection` is 5.14:1 in light but 2.53:1 in dark,
   below AA, so components must use `--color-selection-text` (5.38:1). It also
   says the fill is not a control boundary: 2.73:1 on light surface and 2.53:1
   on light sunken.
4. **One contrast convention.** Both files now state the same method: OKLCH ->
   OKLab -> linear sRGB with no intermediate 8-bit quantization, WCAG relative
   luminance, ratios rounded half-up to two decimals, OKLCH lightness to one
   decimal. Round-2 rows were recomputed under it; rounds 1 and 3 already used
   it.
5. **Round-1 surface ramp marked superseded.** The table keeps its round-1
   values, and the surrounding text now records that round 2 lifted light sunken
   from 88% to 92%, so its sunken rows (1.37:1 from canvas, 1.23:1 from surface)
   are historical. Current light sunken reads 1.21:1 and 1.08:1.

### Recomputed round-2 cells

| Measurement | Recorded | Recomputed |
| --- | --- | --- |
| Interactive border, light canvas / surface / raised / sunken | 4.56 / 4.10 / 4.79 / 3.79 | 4.59 / 4.10 / 4.81 / 3.79 |
| Interactive border, dark canvas / surface / raised / sunken | 4.89 / 4.15 / 3.37 / 5.55 | 4.90 / 4.17 / 3.38 / 5.56 |
| Subtle / sunken, light and dark | 4.72 / 6.48 | 4.74 / 6.46 |
| Subtle on canvas / surface / raised, light | 5.68 / 5.11 / 5.97 | 5.73 / 5.13 / 6.01 |
| Subtle on canvas / surface, dark (66% value) | 5.71 / 4.85 | 5.69 / 4.84 |
| Selection vs canvas / raised / sunken, light | 3.03 / 3.19 / 2.52 | 3.06 / 3.20 / 2.53 |
| Selection vs canvas / surface / raised / sunken, dark | 5.56 / 4.72 / 3.83 / 6.31 | 5.53 / 4.71 / 3.82 / 6.28 |
| Selection text / selection | 5.40 | 5.38 |
| Surface ramp, light surface / sunken vs canvas | 1.11 / 1.20 | 1.12 / 1.21 |
| Surface ramp, dark sunken vs canvas / surface | 1.13 / 1.34 | 1.14 / 1.33 |
| Decorative separator, dark canvas | 1.35 | 1.34 |

No pass/fail conclusion changed. The largest shift is 0.05 in the second
decimal; the tokens themselves are untouched.

### Verification

| Command | Result |
| --- | --- |
| `pnpm format:check` | Pass, `All matched files use Prettier code style!` |
| `pnpm lint` | Pass, no findings (`eslint .` exited 0) |
| `pnpm typecheck` | Pass, no errors (`tsc --noEmit` exited 0) |
| `pnpm build` | Pass, Next.js 16.4.2, compiled successfully, 6 routes generated |

### Concerns

- This report lives under `.superpowers/sdd/`, whose `.gitignore` excludes
  everything, so it was force-added for this commit. If reports should stay out
  of the tree, drop it from the commit; `tokens.css` is the only source change.
- Round-2 measurements now differ by up to 0.05 from what that round recorded.
  The change is measurement method, not tokens, but a reviewer comparing rounds
  will see movement in the second decimal.
- The contrast floors are still human-maintained. No CI check recomputes them if
  a surface or text token moves.
- `--color-accent-subtle` stays a wash at 1.63:1 against canvas. The comment now
  forbids subtle text on it, but nothing enforces that at the component layer.

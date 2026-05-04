# Handoff: WCDB Design System

A design system + page mockups for **WCDB 90.9 FM**, the student-run college radio station at SUNY Albany. The system is **Hanssen-inspired** (Framer template by Pawel Gola): minimal, near-monochrome, editorial, with `Instrument Serif` italic display + sans body + mono accents. Most pages share a **two-column "image cutaway"** layout: the left column holds a sticky hero/now-playing panel with the nav floating over its top edge; the right column is the scrollable feed.

---

## About the design files

The files in this bundle are **design references built in HTML** — prototypes that show the intended look and behavior. They are **not production code to copy directly.**

- They use React via Babel-in-the-browser, inline JSX, and a hand-rolled CSS variable system. That setup is fine for design exploration but not what you want to ship.
- The task is to **recreate these designs in the target codebase's existing environment** — for WCDB that's a Next.js / React / Tailwind project consuming components from `@availabs/dms`. Use that codebase's established patterns, component library, and conventions.
- If the target codebase is greenfield, pick the framework that best fits the team and reimplement there. Treat the HTML as a design spec.

The design tokens (colors, type, spacing, radii) and the layout structures (the two-column split, the inverted footer card, the bare-vs-carded mix) are the parts to faithfully reproduce. The exact JSX/CSS class names are reference scaffolding.

---

## Fidelity

**High-fidelity (hi-fi).** Final colors, typography, spacing, and interaction states are all decided. Pixel-level recreation in the target framework is the goal.

Caveats:
- Imagery in the hero panels is a **placeholder** (gradient + scan-line CSS texture + a giant italic glyph). Production should swap in a real episode image / album art.
- "Latest spins", "DJs", "Events", "Blog posts" are **stubbed copy** — real data should come from the WCDB CMS / spin-tracking API.
- The on-air audio player UI is mocked; wiring it to the actual stream is out of scope.

---

## File map

```
design_handoff_wcdb_design_system/
├── README.md                      ← this file
├── index.html                     ← design system landing page
├── foundations.html               ← color, type, spacing token catalog
├── components.html                ← component catalog (buttons, inputs, cards…)
├── patterns.html                  ← layout patterns (split, hero, schedule rows…)
│
├── home.html                      ← Home / Now Playing  ★ canonical layout
├── listen.html                    ← Listen Live page
├── schedule.html                  ← Weekly schedule grid
├── show.html                      ← Show detail (episode list)
├── djs.html                       ← DJ directory
├── spins.html                     ← Recent spins (full table)
├── blog.html                      ← Editorial blog index
├── events.html                    ← Events list
│
├── styles/
│   ├── tokens.css                 ← design tokens (colors, type, spacing, modes)
│   └── components.css             ← all component CSS (buttons, cards, table, nav…)
│
├── scripts/
│   ├── shell.jsx                  ← system catalog page chrome (TopNav for index/foundations/components)
│   ├── mockup-shell.jsx           ← MOCKUP page chrome (single-col + two-col split shells)
│   ├── home_blocks.jsx            ← home page composition (left + right columns)
│   ├── wcdb-patterns.jsx          ← shared patterns: NowPlayingBar, ScheduleCell, SpinRow, DJCard, ShowHero…
│   └── tweaks.jsx                 ← in-design tweak controls (mode/density toggles)
└── tweaks-panel.jsx               ← starter component for the floating tweaks UI
```

**Start here:** `home.html` is the canonical layout. Read it first, then read `styles/tokens.css` and `styles/components.css`.

---

## Design tokens

All tokens live in `styles/tokens.css` as CSS custom properties. **Two modes** (dark default, light) and **three density levels** (compact / cozy / comfortable) are switched via `<html data-mode="…" data-density="…">`.

### Color — Dark mode (primary)

| Token | Value | Usage |
|---|---|---|
| `--page-bg` | `#0e1011` | Page background — black |
| `--bg-0` | `#0a0a0a` | Deepest |
| `--bg-1` | `#0e1011` | Surface |
| `--bg-2` | `#141618` | Elevated card |
| `--bg-3` | `#1c1e20` | Card hover |
| `--bg-4` | `#1f2122` | Default card surface |
| `--bg-5` | `#2a2c2e` | Pressed |
| `--card-bg` | `#1f2122` | Default card |
| `--card-bg-soft` | `#1a1c1d` | Lower-emphasis card |
| `--inv-bg` | `#f5f5f5` | Inverted card (footer) — white |
| `--inv-ink` | `#0a0a0a` | Text on inverted card |
| `--inv-ink-2` | `#4a4a4a` | Secondary text on inverted card |
| `--inv-line` | `rgba(10,10,10,0.10)` | Hairline on inverted card |
| `--ink-1` | `#f5f5f5` | Primary text |
| `--ink-2` | `#c8c8c8` | Secondary text |
| `--ink-3` | `#8a8a8a` | Tertiary / meta |
| `--ink-4` | `#5a5a5a` | Disabled |
| `--accent` | `#f5f5f5` | Monochrome accent |
| `--accent-soft` | `rgba(245,245,245,0.08)` | Subtle accent fill |
| `--on-air` | `#ff3b2f` | The ONE warning red — used only for live/on-air signals |
| `--on-air-soft` | `rgba(255,59,47,0.12)` | On-air pill background |
| `--line-1` | `rgba(255,255,255,0.06)` | Hairline |
| `--line-2` | `rgba(255,255,255,0.10)` | Stronger divider |
| `--line-3` | `rgba(255,255,255,0.18)` | Strongest divider |

### Color — Light mode

The light mode flips the **page background to off-white (`#fafaf9`)** rather than keeping it black and inverting only cards. Cards become subtle off-white (`#f5f5f4`) and the inverted footer flips to dark.

| Token | Value |
|---|---|
| `--page-bg` | `#fafaf9` |
| `--card-bg` | `#ffffff` |
| `--card-bg-soft` | `#f5f5f4` |
| `--inv-bg` | `#0e1011` (now dark) |
| `--inv-ink` | `#f5f5f5` |
| `--ink-1` | `#0a0a0a` |
| `--ink-2` | `#2a2a2a` |
| `--ink-3` | `#6a6a6a` |
| `--ink-4` | `#a0a0a0` |
| `--accent` | `#0a0a0a` |

The full list is in `tokens.css`.

### Typography

```
--font-display: 'Instrument Serif', 'GT Sectra', 'Times New Roman', serif;
--font-sans:    'Geist', 'Inter', ui-sans-serif, system-ui, sans-serif;
--font-mono:    'Geist Mono', 'JetBrains Mono', ui-monospace, monospace;
```

**Display** is always `Instrument Serif`, **always italic** for headings (`font-style: italic`), with tight letter-spacing (`-0.03em` to `-0.04em`) and line-height `0.92–1.05`. This is the system's most distinctive note — italic serif headlines paired with monospace metadata. **Don't substitute another italic serif without testing**: Instrument Serif's specific glyph proportions carry the editorial feel.

| Token | Value | Usage |
|---|---|---|
| `--tx-9xl` | `clamp(72px, 12vw, 200px)` | Hero display ("Stereolab, somewhere in Albany") |
| `--tx-8xl` | `clamp(56px, 8vw, 128px)` | Page H1 |
| `--tx-7xl` | `80px` | |
| `--tx-6xl` | `64px` | |
| `--tx-5xl` | `48px` | Section H2 (italic) |
| `--tx-4xl` | `36px` | |
| `--tx-3xl` | `28px` | Card title (italic) |
| `--tx-2xl` | `22px` | Body large |
| `--tx-xl` | `18px` | Body |
| `--tx-lg` | `16px` | |
| `--tx-md` | `14px` | Body small / table |
| `--tx-sm` | `12px` | Meta |
| `--tx-xs` | `11px` | Mono uppercase eyebrow |

**Eyebrow style** (used everywhere — appears as small caps with letter-spacing above headlines):

```css
.uppercase-meta {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-3);
}
```

### Spacing

```
--sp-1: 4px    --sp-6: 32px
--sp-2: 8px    --sp-7: 48px
--sp-3: 12px   --sp-8: 64px
--sp-4: 16px   --sp-9: 96px
--sp-5: 24px   --sp-10: 128px
```

### Radii

```
--r-sm: 4px      --r-xl: 18px (canonical card radius)
--r-md: 8px      --r-pill: 999px
--r-lg: 14px
```

The canonical large-card radius is **18px**. Pills use `999px`. Inputs use `999px` (rounded-full) when they are filter chips and `8px` when they are form fields.

### Shadows

```
--shadow-1: 0 1px 0 rgba(255,255,255,0.04) inset;  /* hairline highlight */
--shadow-2: 0 12px 32px rgba(0,0,0,0.45);          /* elevated panel */
```

Used sparingly — most cards rely on background contrast, not shadow.

### Density

`<html data-density="cozy">` is the default. Switching to `compact` or `comfortable` adjusts `--density-y` and `--density-x` (used by table rows, list rows, and some buttons).

---

## The two-column "image cutaway" layout

This is the **signature layout** of the system. It's used for `home.html` and `listen.html`. Read this section carefully — most of the design intent lives here.

### Structure

```
┌────────────────────────────────────────────┐
│ TOP NAV (left half only)  │                │  ← nav has solid bg matching --page-bg
├───────────────────────────│   RIGHT COLUMN │     so it hides the slice of hero under it
│ LEFT COLUMN (sticky)      │   (scrolls)    │
│  • hero/episode image     │                │  ← right starts at top:0, no nav above
│  • editorial caption      │                │
│  • now-playing player     │                │
│                           │                │
│  STAYS PUT while right    │                │
│  column scrolls past      │                │
└────────────────────────────────────────────┘
```

### Critical implementation details

1. **Nav is NOT full-width.** It only spans the left column. The image extends UP under the nav line (the "cutaway"). The nav has `background: var(--page-bg)` (solid black/white) so it visually masks the slice of the hero panel directly beneath it.

2. **Left column is sticky to viewport** with `position: sticky; top: 8px; height: calc(100vh - 16px);` (the 8px matches the `.wc-split__left` padding so it doesn't overshoot — overshoot was a real bug we hit; if you change the padding, change the math).

3. **Right column starts at `top: 0`** with no nav above it. Content (hero, schedule card, spins, etc.) flows straight from the top edge.

4. **Sticky containment requires `align-items: stretch`** on the grid. `align-items: start` will collapse the left column to its content height and the sticky child will scroll out of view. Use `stretch` (the default).

5. **Combined hero + player panel** is ONE rounded card (`--r-xl` / 18px), not two stacked components. The episode image, editorial caption, and now-playing strip all share the same card chrome, separated only by hairlines (`var(--line-1)`).

CSS (`styles/components.css`):
```css
.wc-split { display: grid; grid-template-columns: 1fr 1fr; align-items: stretch; }
.wc-split__left  { padding: 8px; }
.wc-split__right { padding: 0 8px 8px; }

@media (min-width: 768px) {
  .wc-split__left-sticky {
    position: sticky; top: 8px;
    height: calc(100vh - 16px);
    overflow: hidden;
    border-radius: 18px;
  }
}
```

JSX scaffold (`scripts/mockup-shell.jsx::MockupShellSplit`) — note the absolutely-positioned nav inside the sticky container:
```jsx
<div className="wc-split">
  <div className="wc-split__left">
    <div className="wc-split__left-sticky">
      {/* Nav floats absolutely on top of the hero */}
      <header style={{ position: 'absolute', top: 0, left: 0, right: 0,
                       height: 56, background: 'var(--page-bg)', zIndex: 40 }}>
        <Logo /> <NavLinks />
      </header>
      <ShowAndPlayerPanel />  {/* fills 100% height */}
    </div>
  </div>
  <div className="wc-split__right">{rightContent}</div>
</div>
```

---

## Bare-vs-carded mix (right column rhythm)

The right column on `home.html` deliberately mixes **sections sitting directly on the page background** with **sections inside cards**. This is the second signature pattern — most "design system" sites would put everything in cards; this one breathes.

| Section | Treatment | Why |
|---|---|---|
| Page hero ("Stereolab, somewhere in Albany") | **Bare** on page bg | Editorial weight; let the typography carry it |
| On now & up next | **Carded** (`--card-bg`, 18px radius) | Functional table-like content benefits from a panel |
| Latest spins | **Bare** | Visual rhythm — break up the cards |
| Blog promo (Forty-eight years on a hairline) | **Carded** | A featured CTA — the card frames it as a single click target |
| Off the air (events) | **Bare**, individual event tiles inside | Mixed approach — bare section header, card per event |
| Stats (184 listeners, 412 spins, etc.) | **Carded** | Tabular data |
| Footer | **Inverted card** | See below |

### Inverted footer card (`.wc-card-inv`)

The footer is a card with **inverted colors** — in dark mode it's a white card with black text; in light mode it flips to a dark card with white text. The classic Hanssen footer move.

```css
.wc-card-inv {
  background: var(--inv-bg);
  color: var(--inv-ink);
  border-radius: 18px;
}
.wc-card-inv .uppercase-meta { color: var(--inv-ink-2); }
.wc-card-inv hr,
.wc-card-inv .hairline { background: var(--inv-line); }
```

The subscribe form's submit button is **inverted-of-inverted** — solid `--inv-ink` (black) with `--inv-bg` (white) text — so it pops against the inverted card.

---

## Components

All component CSS is in `styles/components.css`. Class names use `wc-` prefix.

### Buttons

| Variant | Class | Background | Text | Use |
|---|---|---|---|---|
| Primary | `.wc-btn.wc-btn--primary` | `--accent` (white in dark / black in light) | `--accent-ink` | Listen Live, primary CTAs |
| Secondary | `.wc-btn.wc-btn--secondary` | transparent | `--ink-1`, 1px border `--line-2` | Secondary actions |
| Ghost | `.wc-btn.wc-btn--ghost` | transparent | `--ink-2` | Tertiary, in-card |
| Link | `.wc-btn.wc-btn--link` | none | `--ink-2` with arrow | "All spins →" |

Sizes: `.wc-btn--sm` (h:32, px:12, fs:12), default (h:38, px:16, fs:13), `.wc-btn--lg` (h:48, px:24, fs:14).
Radius: **999px (pill)** — buttons are always pills.

### Pills

`.wc-pill` — small monospace status pill, rounded-full, 1px border `--line-2`.
`.wc-pill--onair` — red on-air variant: `background: var(--on-air-soft)`, `color: var(--on-air)`, with a pulsing dot (`@keyframes pulse-dot`).

### On-air dot animation

```css
@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%      { opacity: 0.5; transform: scale(0.85); }
}
```

### Equalizer animation (`.wc-eq`)

A row of `<span>`s that scale vertically on a sine offset to suggest audio:
```css
@keyframes equalizer {
  0%, 100% { transform: scaleY(0.3); }
  50%      { transform: scaleY(1); }
}
```
Each span: `width: 3px; height: 100%; background: currentColor; transform-origin: bottom; animation: equalizer 1.2s ease-in-out infinite;` with staggered `animation-delay` per child.

### Inputs

`.wc-input` — transparent, 1px border `--line-2`, radius 999px (filter chips) or 8px (form). Padding `10px 14px`. Focus: `border-color: var(--ink-2)`, no outline.

### Segmented control

`.wc-seg` — horizontal pill row of `.wc-seg__item` buttons. Active item has `background: var(--accent-soft)` and `color: var(--ink-1)`.

### Table

`.wc-table` — used on `spins.html`. Borderless, with `1px solid var(--line-1)` top borders on each row (no bottom border). Column header row: monospace, uppercase, letter-spacing 0.12em, `--ink-3`. Cell padding follows `--density-y` × `--density-x`.

### Top nav

`.wc-topnav__item` — pill-shaped link with an animated underline (`::after`, `transform: scaleX(0→1)` on hover/active, transition 500ms cubic-bezier).
`.wc-topnav--left` (variant) — used on the cutaway layout; solid page-bg behind, `--ink-1` text.

### Cards

The base card is just `background: var(--card-bg); border-radius: 18px; padding: 28-32px;` — no shadow, no border. Soft variant: `var(--card-bg-soft)` for nested cards (event tiles inside the bare events section).

---

## Page-by-page specs

### `home.html` (canonical)

Layout: **two-column split** (see above). Active nav: **Listen**.

**Left column (sticky):**
1. Top nav over the hero panel — logo + Listen / Schedule / Shows / DJs / Spins / Blog / Events
2. Hero image area (placeholder gradient with scan-line texture and a giant italic "L.M." glyph in the lower-left)
3. Editorial caption: eyebrow ("LATE MODERNISM · W/ DJ HALFTONE · MAR 05") + italic serif headline
4. Hairline divider
5. Now-playing strip: 64px album art + on-air pill + track title (italic serif) + album/year + circular ▶ button (52px, pill)
6. Progress bar (3px tall) + listener count meta row

**Right column (scrolling):**
1. Hero (bare) — eyebrow + giant italic 3-line headline + body copy + 2 buttons
2. Schedule (carded) — "On now & up next" with 3 rows
3. Spins (bare) — "Latest spins" — 5 rows
4. Blog promo (carded) — "Forty-eight years on a hairline" featured CTA
5. Events (bare with tile sub-cards) — "Off the air" — 3 event tiles
6. Stats (carded) — 4-column figures: 184 listeners, 412 spins, 48 years, 52 DJs
7. Footer (inverted card) — tagline + email subscribe + 4-col link grid + meta row

### `listen.html`
Single-column shell. Big "Listen." headline. Large play button + on-air card. Three-column "Where to listen" grid (Over the air / Online stream / Apps). "Just played" recent spin list.

### `schedule.html`
Single-column. Day strip (Mon–Sun pill row). Full-week list of shows: time / show name (italic serif) / host / pill tags. Live row uses `--on-air-soft` background.

### `show.html`
Single-column. Crumb breadcrumb. ShowHero block (large episode artwork + show metadata sidebar). 2-column section: about copy + host card with stats. Episode list (5 rows, "S03E22 · Mar 05 · Tape music & tape loops" etc.).

### `djs.html`
Single-column. Search + segmented filter (All / Music / Talk / Sports). 3-column grid of DJCard tiles — circular gradient avatar, name (italic serif), handle (mono), tagline, year joined.

### `spins.html`
Single-column. Search + segmented time filter (Today / Week / Month / All) + Export CSV button. Full table with columns: Time / Artist (italic serif) / Track / Album / Show (mono uppercase) / Plays. Plays column shows ×N pill if >1.

### `blog.html`
Single-column. Featured post (large carded hero) + 2-column grid of secondary posts. Each post: category eyebrow ("DISPATCH · MAR 03") + italic serif headline + body copy + author meta.

### `events.html`
Single-column. Large list with date column (month + giant italic day number 88px) on the left, event details in middle, RSVP info on the right. Subtle background tint on hover.

### `index.html` / `foundations.html` / `components.html` / `patterns.html`
Design system catalog pages. These are NOT product pages — they document the system itself. The dev does not need to ship these. They're included for reference if questions come up about token meanings.

---

## Interactions & behavior

### Implemented in the mocks
- Top nav: hover state with animated underline (500ms cubic-bezier expansion).
- Buttons: 200ms color transitions on hover.
- Pulsing on-air dot (continuous animation).
- Equalizer bars (continuous animation).
- Schedule rows on hover (faint background tint).
- Spin/episode rows on hover (background tint to `--bg-2`).
- Mode toggle (dark / light) and density toggle live in the floating Tweaks panel — `data-mode` and `data-density` attrs on `<html>`.

### NOT implemented (production scope)
- Real audio streaming — clicking ▶ should connect to the WCDB stream URL.
- Real now-playing data — should poll the spin-tracking API.
- Search inputs are non-functional.
- Segmented filters are non-functional.
- Newsletter subscribe form is non-functional.
- No mobile breakpoint tested below 768px (the split layout collapses to stacked at <768px via the existing media query, but mobile-specific designs were not produced — confirm with design before shipping mobile).

---

## State management (when implementing in target codebase)

Stores/queries the implementation will need:
- **Stream state**: playing | paused | buffering. Bound to a single audio element.
- **Now-playing**: `{ artist, track, album, showName, host, startedAt }` — refresh every 30–60s.
- **Schedule**: full week, indexed by day.
- **Listener count**: poll-based.
- **Recent spins**: paginated list, sortable by time/artist/show.

The mocks all use static data — none of this is wired.

---

## Assets

- **Fonts**: Google Fonts CDN — Instrument Serif, Geist, Geist Mono. (Plus Fraunces/Oswald/Inter/IBM Plex Mono on the `index.html` system landing page only — those are not used in product pages.) Production should self-host these via `next/font` or equivalent.
- **No bitmap images** — all hero "imagery" is CSS gradients + scan-line patterns + giant italic glyphs. Real photography should replace these placeholders.
- **No icon library** — the few icons used (▶, →) are unicode characters.
- **Logo**: the WCDB wordmark is a `<WCDBMark />` component (`scripts/wcdb-patterns.jsx`) — currently text-only ("WCDB · 90.9 FM"). Replace with the official station logo asset if one exists.

---

## Implementation notes for the developer

- **Skip the Babel-in-browser setup.** Reimplement in the target stack (Next.js + React + Tailwind + `@availabs/dms`).
- **Tokens → Tailwind config.** Move the CSS variables into `tailwind.config.js` as `theme.extend.colors`, `fontFamily`, `fontSize`, `borderRadius`. Keep them as CSS vars too if you want runtime mode switching.
- **Two-column split** is the trickiest piece — the sticky-with-cutaway-nav pattern needs the exact CSS structure (sticky parent + absolutely positioned nav inside it + `align-items: stretch` on the grid). Test scrolling immediately; we hit two bugs there during design (`align-items: start` killed the sticky, and a stray non-media-query rule overrode the sticky position). See "Critical implementation details" above.
- **`@availabs/dms` overlap.** Some components (buttons, inputs) likely already exist in `@availabs/dms`. Use them where they match; only build custom for the editorial pieces (split layout, italic serif headlines, inverted footer card) that don't have direct equivalents.
- **Italic serif headlines are non-negotiable.** The whole system reads as editorial/analog because of `Instrument Serif` italic. Don't replace with a generic serif.
- **The single red.** `--on-air: #ff3b2f` is the only chromatic color in the system. Use it ONLY for live-broadcast indicators — not for errors, links, or other UI states.
- **Mobile.** The split layout collapses to single-column at <768px but mobile screens were not designed in detail. Coordinate with design before building mobile.

---

## Questions to resolve with design before building

1. Mobile layout for the home page — does the sticky panel become a fixed bottom bar? A normal hero section?
2. Real photography sources for hero images — does the station have a photo library or should we commission?
3. Audio player behavior — does the sticky left panel persist its player state across page navigations (SPA) or reload (MPA)?
4. Search behavior on `djs.html`, `spins.html`, `blog.html` — instant filter, server search, or both?
5. Light mode — is it a user preference toggle, system-preference-respecting, or per-page (e.g., always-light blog)?

# Skill feedback · v0.2 build

Notes captured while building `dms_design_system_v2/` from
`design_handoff_transportny_design_system/`. Each item is an
ambiguity in the skills that cost real time, with a suggested edit.

Spread across these files:
- `src/dms/skills/designing-a-dms-design-system.md`
- `src/dms/skills/translating-design-system-to-dms-theme.md`
- `src/dms/skills/README.md` (the index)

---

## 1. The handoff "components" gap

**Problem.** The handoff for TransportNY shipped many primitives the
brand uses heavily (TNYPageHeader, TNYBreadcrumb, TNYFilterBar, KpiCard,
StatTile, MetricCard) but several primitives that the *DMS platform*
ships were not in the handoff at all (Drawer, Popup, DeleteModal,
NavigableMenu, draggableNav, Pagination as its own primitive, Lexical
full block menu). v2 ships them anyway with sensible brand defaults
because skill §7.5 says "every UI primitive listed in §2."

But §7.5 is ambiguous about what to do when **the brand doesn't depict
a primitive**. The current text says "unless this theme is explicit
about not supporting it." That phrasing is vague:

- A README note? (v1 took this path.)
- A literal "skipped" annotation in `components.html`?
- A muted demo with the codebase default visible plus a
  one-line "TransportNY does not theme this" caption?

**Suggested edit (designing-a-dms-design-system.md §7.5):**

> ### Primitives the brand declines
>
> If a brand genuinely doesn't ship a primitive (e.g., a long-form
> reading theme that never renders a Map), `components.html` should
> still include a Section for that primitive titled
> `<Primitive> · not themed`. That section should:
>
> - Render the primitive at its codebase default — *not* a brand-
>   styled mock — so a reviewer can see what end-users will get.
> - Have a one-sentence rationale in the Section description.
>
> This is a contract: a missing Section means "we forgot," a
> present-but-unstyled Section means "we decided."

## 2. Where the meta-nav strip lives in the markup tree

**Problem.** §7.0 says the strip lives "at the very top of `<body>`,
above the in-DMS TopNav each page renders." Fine — but the skill is
silent on whether the strip is:

- (a) **part of the Layout** — and therefore eligible to be themed via
  theme keys; or
- (b) **documentation chrome** — a single CSS class that never appears
  on a live DMS site.

If (a), the brand has to ship the strip's styling in theme.js, which
gets it onto every real DMS page as well — wrong. If (b), every
mockup HTML duplicates the strip markup verbatim.

**v2 chose (b)** and added `.tny-meta-nav` to `_shared.css`. It works
but adds 22 lines of duplication per page (the strip is 17 `<a>` tags
across 14 pages).

**Suggested edit (designing-a-dms-design-system.md §7.0):**

> The meta-nav strip is **documentation chrome, not Layout chrome.**
> Style it via a single class in `_shared.css` (convention:
> `.<brand-prefix>-meta-nav`). The strip never appears on a live DMS
> site — a real DMS page hasn't got a "go to design-system" link.
>
> If you find yourself wanting to theme the strip via theme keys,
> stop: you're conflating documentation chrome with product chrome.
>
> *Optional future:* a small build-step-free preprocessor could
> `<include>` the strip from a partial. The skill currently disallows
> a build step (§8) — until that changes, accept the duplication and
> grep-replace when the page list changes.

## 3. SideNav vs TopNav on the design-system pages

**Problem.** The skill nowhere specifies which Layout / nav the
design-system pages should themselves use. v1 used SideNav. The
handoff used SideNav. v2 used SideNav. But every brand will face
this choice fresh, and the skill should opine.

The right rule (which we landed on by trial):

> **Design-system pages should use the same Layout the brand's
> *product* pages use.** That way the design system documents the
> brand by being a real example of it.

This is a corollary of §7.1 ("pages as documentation") but not
explicit.

**Suggested edit (designing-a-dms-design-system.md §7.1):**

> The `design-system/` pages should use the same Layout variant the
> brand's product pages use (typically `app` with SideNav). The
> brand documents itself **as the brand** — not in a generic
> documentation chrome. If a reviewer can't tell the design-system
> pages apart from product pages at a glance (modulo content),
> you've nailed it.

## 4. The `_shared.css` mirror duplication problem

**Problem.** The skill says (§8) the mockups can't import from
`theme.js`. So class strings get duplicated. But it *also* says
(§7.1) `_shared.css` is the home for surface utilities that can't
be Tailwind classes. The result: any time `index.css.additions`
changes, you have to manually mirror it into `design-system/_shared.css`
and `pages/_shared.css`.

v2 has three copies of the same CSS file:

- `theme/index.css.additions` (the canonical, ships with theme)
- `design-system/_shared.css` (the design-system mirror)
- `pages/_shared.css` (the pages mirror)

The skill should call this out as a maintenance gotcha and recommend
either:

- Making `_shared.css` a symlink in dev (POSIX only — Windows breaks)
- Committing to `cp` discipline (current state, error-prone)
- Allowing a single relative link `<link rel="stylesheet" href="../theme/index.css.additions"/>` from both subfolders — which v2 could have done but didn't

**Suggested edit (designing-a-dms-design-system.md §8):**

> ### `_shared.css` — one copy, two consumers
>
> `theme/index.css.additions` is the canonical source. Both
> `design-system/*.html` and `pages/*.html` should link to it via
> a relative path:
>
> ```html
> <link rel="stylesheet" href="../theme/index.css.additions"/>
> ```
>
> Earlier guidance suggested copying the file into `design-system/_shared.css`
> and `pages/_shared.css`. **Don't** — the copies drift. The CDN
> Tailwind setup doesn't care about the `.additions` extension; the
> file is plain CSS.

## 5. `_replace` documented in §3.1.55 but easy to miss

**Problem.** The `_replace` mechanism for `sectionArray.sizes` is
documented in `translating-design-system-to-dms-theme.md` §3.1.55,
but it's buried mid-document and easy to skip. The v1 pass did skip
it: v1's `sectionArray` overlay deep-merged the 6-col defaults into
the 12-col override, leaking 6 stale keys.

**Suggested edit (translating-design-system-to-dms-theme.md §0/§1):**

Add a "if you take nothing else from this skill" boxed callout at
the top:

> **Three gotchas every theme hits, in order of frequency:**
>
> 1. **TopNav / SideNav keys** (§3.1) — open `.theme.{js,jsx}` first;
>    don't invent keys from your mockup div names.
> 2. **`pages.sectionArray.styles[0]` `_replace`** (§3.1.55) — without
>    it, your 12-col `sizes` map silently inherits the 6-col defaults.
> 3. **`lexical.heading_h1..h6` must be set explicitly** (§3.1.5
>    Quirk 2) — the textSettings backfill only fires when these are
>    falsy, and the codebase ships them set.

Three sentences at the top of the skill would save every brand
half a day of debugging.

## 6. `card-layout.md` and `creating-page-section-components.md` should be linked from the design skill

The design-system skill points readers at
`src/themes/CLAUDE.md` (the "configure the Card, don't write a new
component" philosophy) but doesn't link to `card-layout.md` even
though that's the load-bearing reference for the workhorse
primitive.

**Suggested edit (designing-a-dms-design-system.md §2 / §12):**

Reading list at the end should include `card-layout.md` and
`creating-page-section-components.md` so they're discoverable.

## 7. Skill index needs a one-line "in what order to read"

The skills index in `src/dms/skills/README.md` is grouped by topic
("Building components / Theming / Layout reference / Authoring at
the pattern level / Recipes"). A new contributor reading them
discovers an order through trial-and-error:

> Read **`designing-a-dms-design-system.md`** first (the structural
> grammar). Then **`translating-design-system-to-dms-theme.md`**
> (the runnable theme contract). Then `card-layout.md` (the Card's
> knobs). Then `creating-pages-from-a-design-pattern.md`. Then the
> recipes.

**Suggested edit (skills/README.md):** add this reading order as a
preface above the topic-grouped index. Saves every newcomer a
fumble.

---

## Findings from the v0.2 second-pass (after the initial build)

The items above were captured during the initial v2 build. The
items below were captured iterating on v2 with the user — they're
real failure modes that the skill files didn't prevent, even though
the original build "looked done" before each one surfaced.

## 8. Brand font-family classes need real CSS definitions, not just `tailwind.config`

**Problem.** The translation skill §1.1 / §6.1.1 establishes that
brand font families get registered via the Play CDN's inline
`tailwind.config` block:

```html
<script>tailwind.config = { theme: { extend: { fontFamily: { display: ['Oswald', …] } } } };</script>
```

This works **only on pages that ship that script tag**. If 13 of 14
mockup pages don't have it (v2 only had it on `theme.html`), then
`class="font-display"` resolves to nothing on those pages and every
heading falls back to system sans. The font files load fine via
`@font-face`; the class names just don't get any `font-family`
declaration attached.

Result: the user reloads the page, sees Helvetica-looking headings,
and reports "the title fonts are much weaker than the handoff."
Diagnosis took two round-trips with screenshots.

**The fix that always works**: define the classes as plain CSS in
`_shared.css`, alongside the existing `@font-face`:

```css
.font-display, .font-oswald { font-family: "Oswald", "Bebas Neue", sans-serif; }
.font-proxima               { font-family: "Proxima Nova", "Source Sans 3", system-ui, sans-serif; }
```

That makes the brand classes work on every page regardless of
whether Tailwind's runtime saw the inline config in time. The
inline config is then optional (it adds the same class names as
proper Tailwind utilities, but the plain-CSS rules already cover
the use case in mockups).

**Suggested edit (designing-a-dms-design-system.md §8 implementation rules):**

Add an explicit requirement under "MUST" — *"every brand
font-family class referenced by mockups must be defined as a plain
CSS rule in `_shared.css`, not relied on from an inline
`tailwind.config`. The inline config is per-page and easy to forget
on N-th page; the CSS rule covers every mockup that links the
stylesheet."*

The translation skill §6.1.1 should also mention this: the
`tailwind.config` block is for the *production runtime*, not for
the static mockups.

## 9. Google Fonts CDN is the simpler font path for HTML mockups

**Problem.** v2 originally shipped local `Oswald-Variable.woff2`
into `theme/fonts/`, but the `@font-face` declaration in
`_shared.css` uses `url("./fonts/Oswald-Variable.woff2")` — and
`_shared.css` lives in **three** directories (`theme/`,
`design-system/`, `pages/`). Each location's `./fonts/` resolves
differently, requiring three copies of the font file. Plus
`file://` browsing can silently CORS-block woff2 even when paths
resolve.

The user pre-chose "Option C — bundle locally" thinking it would be
simplest. It wasn't — Google Fonts CDN was actually simpler:

- One `<link>` in every mockup head (12 lines of total markup)
- No font folder maintenance
- No path resolution issues
- Works on `file://` (Google Fonts CDN serves with proper CORS headers)
- Matches what the production `theme.js` `fonts: [{ type: 'google', href }]` entry already does

**Suggested edit (designing-a-dms-design-system.md §8 / new §8.2):**

> ### Mockup fonts — Google Fonts CDN, not local woff2
>
> Load brand typefaces via Google Fonts CDN in every mockup's
> `<head>`:
>
> ```html
> <link rel="preconnect" href="https://fonts.googleapis.com">
> <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
> <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Source+Sans+3:wght@400;500;600;700&display=swap">
> ```
>
> Do **not** bundle local `.woff2` files for the mockups. The
> `_shared.css` lives in multiple subdirectories and relative
> paths drift; `file://` previewing has woff2 CORS quirks; and the
> mockups duplicate every kilobyte. Local fonts belong in the
> *production* theme (`theme/fonts/`) consumed by the
> `theme.js` `fonts` array — that's an orthogonal concern.

## 10. The `mx-auto` centering trap on product LayoutGroups

**Problem.** The codebase default ships
`sectionArray.styles[0].layouts.centered: 'max-w-[1020px] mx-auto'`
and the v1 + v2 themes inherited the `mx-auto` reflexively. On a
product surface with a persistent sidebar (Layout `app`), this
produces a centering drift on wide monitors — content pulls away
from the sidebar's right edge and floats in the middle of the
viewport. The handoff doesn't do this because it uses
`<main className="ml-60">` with no max-width and `px-10` for
breathing room — content is naturally left-aligned with the
sidebar.

The user noticed this immediately on side-by-side screenshots
("the content in the content pane was left aligned, here the
content is more centered"). The fix is one-character in spirit
(`mx-auto` → `mr-auto`) but applies in 8 places in `theme.js` and
across all 14 mockup pages.

**The rule:**
- Product LayoutGroups (`content`, `content_tint`, `header`,
  `hero`, `tone_bar`, `tone_bar_dark`, `footer`): use `mr-auto`
  so content hugs the sidebar's right edge.
- `sectionArray.layouts.centered`: also `mr-auto` (not `mx-auto`).
- **Only `auth`** keeps `mx-auto` — sign-in forms are the one
  intentional centred surface.

**Suggested edit (designing-a-dms-design-system.md §7.3 / §4.2):**

Add a "Common gotcha" callout under LayoutGroup variants:

> **Product LayoutGroups use `mr-auto`, not `mx-auto`.** The
> codebase default and most Tailwind examples reach for
> `mx-auto` to centre a max-width container. On a product surface
> with a persistent SideNav, this drifts content away from the
> sidebar's right edge on wide monitors and looks "marketing-y."
> Use `mr-auto` (or omit the margin utility entirely) so the band
> hugs the sidebar with `px-8` for breathing room.
>
> Apply the same change to `sectionArray.styles[0].layouts.centered`
> in the translation skill — the codebase default `'max-w-[1020px]
> mx-auto'` is wrong for any product theme. Override to
> `'max-w-[<your-cap>] mr-auto'`.

The translation skill §3.1.55 already lists `layouts.centered` as a
common override but only flags the max-width value (1020 → 1280).
It should also flag the `mx-auto` → `mr-auto` swap.

## 11. `layouts.html` needs a literal wrapper-class reference table

**Problem.** v2's first `layouts.html` listed LayoutGroup variants
in card-with-thumbnail form. The cards conveyed the *visual* shape
of each variant but not the *literal class strings* on `wrapper1` /
`wrapper2`. Result: the `mx-auto` reflex sat invisible in the
theme overlay for hours — there was no place on the design-system
pages where a reader could see all eight wrapper2 strings
side-by-side and ask "wait, why are the product ones centred?"

After adding a 4-column reference table (variant · wrapper1 ·
wrapper2 · alignment) to v2's `layouts.html`, the drift would have
been visible at a glance — `mx-auto` repeated 7 times on every
product variant. Adding an explicit "Alignment" column
(`left-aligned · 1480 cap` / `centred (intentional)` /
`full-bleed · no cap`) makes the intent legible without parsing
class strings.

**Suggested edit (designing-a-dms-design-system.md §7.3):**

Make the wrapper-class reference table a required section of
`layouts.html`. Update the recommended page structure table to
include:

> | Section | Shows |
> |---|---|
> | … | … |
> | Card or Lexical | **LayoutGroup wrapper class reference** — a table with one row per named variant, columns for `wrapper1` / `wrapper2` / **alignment**. The `wrapper2` column holds the literal class string. The alignment column states the intent (`left-aligned · cap`, `centred · cap`, `full-bleed · no cap`). |

The point of this section is to surface the `mx-auto` family of
decisions visually so they can't drift silently.

## 12. The `layouts.centered` vs `layouts.fullwidth` nesting deserves its own subsection

**Problem.** The relationship between the LayoutGroup wrapper2
class and the `sectionArray.layouts.centered` / `layouts.fullwidth`
class — including the `group.full_width === 'show'` editor toggle
that picks between them — was buried in two skills. The design
skill §7.4 (grid.html) mentions it as one bullet; the translation
skill §3.1.55 mentions it as a max-width override but skips the
`group.full_width` editor flag. Nowhere in either skill does the
reader see the actual `sectionArray.jsx` line:

```js
className={`
  ${theme.container}
  ${theme.layouts[group.full_width === 'show' ? 'fullwidth' : 'centered']}
`}
```

That line is what makes the system go. The toggle lives in
`patterns/page/pages/edit/editPane/sectionGroupsPane.jsx` as a
two-item menu (`off` / `show`) that sets
`group.full_width` on the group row, and `sectionArray` reads it
to pick which class to apply.

Without this knowledge, an author writing mockups doesn't know:
- That `layouts.fullwidth` is reachable from the editor UI
  (it isn't a developer-only setting).
- That `workbench` LayoutGroup should be **paired** with
  `group.full_width: 'show'` for the map to actually go
  edge-to-edge — otherwise the workbench band drops its max-width
  but the inner sectionArray still applies `layouts.centered`.

**Suggested edit (designing-a-dms-design-system.md §7.3):**

Add a dedicated subsection to `layouts.html`:

> ### Section width — regular vs full-width groups
>
> Inside any LayoutGroup, the sectionArray picks one of two
> classes based on `group.full_width`:
>
> | `group.full_width` | Class applied | Result |
> |---|---|---|
> | `'off'` (default) | `layouts.centered` (`'max-w-[N] mr-auto'`) | Sections capped at the brand width, left-aligned |
> | `'show'` | `layouts.fullwidth` (`''`) | Sections fill the parent — useful for map workbenches, dense canvases |
>
> The toggle is exposed in the section-groups editor as a
> *Full Width: off / show* menu item — see
> `sectionGroupsPane.jsx`. Authors set it per-group; developers
> don't intervene.
>
> **Pair with the LayoutGroup variant.** Setting
> `group.full_width: 'show'` on a `content` group still constrains
> the section to the parent's max-width because `wrapper2` itself
> caps at 1480. For a true edge-to-edge map workbench, use the
> `workbench` LayoutGroup variant (which drops `max-w` from
> `wrapper2`) **and** set `group.full_width: 'show'`.

## 13. Sticky right-rail TOC is a brand-recurring pattern, not a one-off page detail

**Problem.** The handoff for TransportNY uses sticky right-rail
TOCs on six of its pages: `theme`, `components`, `patterns`,
`grid-system`, `getting-started`, `docs-overview`. v2 only
preserved them on `theme` and `docs-overview` because the design
skill describes pages as "Layout > LayoutGroups > Sections" and
doesn't enumerate recurring brand patterns. I read the TOC as a
per-page decoration rather than a brand pattern; it got dropped on
4 of 6 pages.

The user noticed on screenshot review ("a lot of pages which had
like a table of contents pane, like the getting started page lost
it"). Restoring required wrapping every content LayoutGroup in
`grid grid-cols-[1fr_240px] gap-8` with the inner content in
`min-w-0 grid grid-cols-12 gap-6` and a sticky `<aside>` on the
right. Two-column wrapper inside a LayoutGroup isn't strictly DMS-
contract-shaped, but it's pragmatic — the alternative is a TOC as
a `col-span-3 sticky` Section pinned with `row-start-1` +
`col-start-10`, which the design skill doesn't bless either.

**Suggested edit (designing-a-dms-design-system.md §7):**

Add a §7.6.5 "Brand-recurring patterns to transcribe":

> When translating a handoff design system into the DMS deliverable,
> watch for *recurring* patterns that appear across multiple pages.
> These aren't covered by primitives in §2 or page archetypes in
> §7.6 — they're brand conventions that the handoff applies to
> every page of a certain type. Common ones:
>
> - **Sticky right-rail TOC** — anchored to section heads. Appears
>   on documentation pages, multi-section catalogs, design-system
>   reference pages. Implement as a `[1fr_240px]` two-column
>   wrapper inside the content LayoutGroup with the right column
>   `position: sticky`. The DMS contract doesn't ship a native TOC
>   primitive, so this is documentation-time wrapping — note it on
>   the design system's `patterns.html`.
> - **Breadcrumbs** — almost always present on product pages.
>   Note the separator character and metadata that flows next to
>   them.
> - **Metadata strip** (refresh timestamp, status dot, data
>   currency). Appears on dashboards.
>
> Catalogue these recurring patterns explicitly during the
> handoff read, before producing pages. The simplest test: if you
> see a UI element on 3+ pages in the handoff, it's a pattern,
> not a one-off.

Also worth adding to the design skill's §10 done criteria: *"every
recurring pattern depicted on 3+ handoff pages is preserved on
every page that should have it."*

## 15. Handoff = design intent. Theme = available primitives. Both, not either.

**Problem.** The first v2 `map-21.html` pass came back with a sharp
critique: section titles dropped, KPI number fonts changed from
Oswald to mono, status badges turned into dot+text instead of the
handoff's colored-bg pills, and a quarter of the content
(MeasureTabs, FilterChips, MPO small-multiples, Methodology) was
replaced with my own structural ideas. The user's question — *"why
are we changing so much in the translation?"* — was on point.

The root cause was **token-first translation**:
- I read the brand brief ("numbers are mono", "status is a dot, never
  a background") as the contract.
- I treated the handoff as one of two reference implementations,
  not the canonical design.
- When they disagreed, I followed the brief and quietly "improved"
  the design.

Both halves of that were wrong. The handoff is the design that was
reviewed and approved. The brief is documentation of intent, not the
contract. **When they disagree, the handoff wins** — because that's
what people signed off on.

But "the handoff wins" doesn't mean "copy the handoff's class strings
verbatim." That's the *other* trap. The handoff was built before the
final theme primitives existed; it may use class strings that don't
exist in the theme, or compose primitives in a way the theme has a
better answer for. **The theme's primitives are the available
building blocks. The handoff is the spec for what to assemble out of
them.**

The right shape of the rule:

> **Faithful transcription** means preserving the handoff's
> *content + structure + primitive selection* — same sections,
> same eyebrows + h2 titles, same kinds of cards/tabs/chips/charts
> arranged in the same order with the same data. The implementation
> uses the theme's primitives styled with the theme's tokens; where
> the handoff used a class string the theme doesn't have, map to the
> nearest token rather than copying the inline value.
>
> Two specific deviation traps to watch for:
>
> 1. **Token-first invention.** When the brief says one thing and
>    the handoff does another, follow the handoff. The brief
>    documents intent; the handoff is the contract. Reconcile by
>    updating the brief later, not by changing the page.
> 2. **Class-string copying.** When the handoff uses
>    `font-oswald font-semibold text-[22px]` and the theme has
>    `displaySM` (`font-display font-medium text-[22px]`), use
>    `displaySM` even if the weight differs. The token represents
>    the brand's intended size+family role; tweaking 600 → 500 may
>    feel like a regression on that one element but keeps the brand
>    consistent across the catalogue.

**Suggested edit (designing-a-dms-design-system.md §7.7 / new §7.7.1):**

Add a "Transcription discipline" callout to §7.7 (`pages/`):

> ### 7.7.1 Transcription discipline — when a handoff exists
>
> If the brand ships a high-fidelity handoff (HTML/JSX prototypes,
> Figma frames), your `pages/` mockups are *transcriptions* of those
> designs, not redesigns:
>
> - **Content**: every visible element in the handoff page appears
>   in your transcription. Same eyebrows, same titles, same chips,
>   same metric cards. No "improvements" that drop content the
>   handoff includes.
> - **Structure**: same sections in the same order, with the same
>   relative spans. The handoff is the layout contract.
> - **Primitives**: pick the closest theme primitive for each
>   handoff element — the *role* matches, even if a class string or
>   weight has to change to use the theme's tokens.
> - **Tokens**: every text style on every transcribed page is a
>   `textSettings` token (display/displayItalic/prose/meta) plus
>   orthogonal modifier axes (color, family, italic, tabular-nums,
>   uppercase). No invented sizes (`text-[19px]`), no invented
>   weights, no inline `style="font-family: …"`.
>
> When handoff and brief disagree, the handoff wins. Note the
> disagreement in the brand README so the brief can be reconciled
> later.

Also update §12 reading list: bump the handoff/completed design
systems above the brand brief when a handoff exists. The current
ordering ("brand brief first, completed examples sixth") encourages
the token-first trap.

## 16. Text styling on transcribed pages must come from `textSettings`

**Problem.** The first v2 `map-21.html` pass used a flurry of inline
class strings — `text-[22px]`, `text-[44px]`, `font-medium text-[15px]`,
etc. — none of which mapped to `theme.textSettings`. The result:

- The `valueFontStyle` dropdown an author would see in a real DMS
  Card section couldn't reproduce the page's look (the dropdown is
  populated from `Object.keys(textSettings.styles[0])`; classes
  invented inline aren't in there).
- Type drift creeps in across pages — two pages render "the same
  thing" with slightly different sizes (22 vs 24, 38 vs 40) and the
  brand loses coherence.
- The brief's "12–18 tokens" rule (§7.2.1) becomes meaningless if
  pages don't actually use the tokens.

The rule should be explicit:

> **Every text style on every mockup page resolves to a
> `textSettings` token.** No `text-[<arbitrary>px]`, no inline
> font weights / families, no `style="font-…"`. Orthogonal modifier
> axes (color, family, italic, tabular-nums, uppercase) are applied
> at the call site as additional classes — that's not "inventing a
> token", that's using the token correctly.
>
> If a page needs a treatment that doesn't fit any existing token,
> either:
>
> 1. **Use the closest existing token** (and accept the trade-off
>    — it's almost always invisible at design review).
> 2. **Add a new token to the type section of `theme.html`** —
>    declared first, applied second. Don't add it on the call site
>    and call it a token.
>
> Apply the "earn-a-token rule" from §7.2.1 before adding one.

**Suggested edit (designing-a-dms-design-system.md §8 implementation rules):**

Add to the MUST list:

> - ✅ **Every text class string on every mockup page resolves to a
>   `textSettings` token.** Orthogonal modifier axes — color
>   (`text-emerald-700`), family (`font-display` / `font-proxima`),
>   `italic`, `tabular-nums`, `uppercase`, `tracking-…` — are
>   applied at the call site as additional classes; they're not
>   "inventing tokens." But `text-[19px]`, `font-medium text-[37px]`,
>   inline `style="font-…"`, and any other invented size/weight
>   combination are out — pick the nearest token or earn a new one
>   in `theme.html`'s Type section first.

## 14. The workbench LayoutGroup is under-discoverable

**Problem.** In the v2 audit, exactly one page (`map-21.html`)
uses the `workbench` LayoutGroup. The dashboards `congestion.html`
and `work-zones.html` both render maps inside ordinary `content`
LayoutGroups, which constrains the map to 1480 max — same drift-
from-sidebar problem as `mx-auto`, just applied to the map. The
skill doesn't say "any time you render a map or dense canvas, use
the `workbench` variant" — so the v2 build only used it where the
handoff explicitly called it out.

**Suggested edit (designing-a-dms-design-system.md §7.3 / §7.6):**

In the LayoutGroup variants section, the `workbench` description
should include a "when to use" clause:

> **`workbench`** — full-bleed band, no max-width on `wrapper2`,
> tighter vertical padding. **Use whenever a Section needs
> edge-to-edge canvas:** map workbenches, dense data tables that
> need horizontal scroll, code editors, chart canvases that benefit
> from extra width. Pair with `group.full_width: 'show'` so the
> sectionArray inside also drops its max-width — otherwise the band
> goes edge-to-edge but the inner grid is still capped.

And on `patterns.html`, the "Data dashboard · operational"
archetype should explicitly mention the workbench pairing for any
map sections it includes.

---

## Out of scope / things that were fine

These are not skill bugs — they're tradeoffs the skill called out
correctly and the build benefited from:

- The plain-HTML / no-build constraint (§8). Painful in the moment;
  worth it as an honesty check. Found three "design ideas that DMS
  can't render" before they hit code.
- The "every Section on the grid documented in `grid.html`" rule
  (§10 #6). Made every dashboard page's layout decisions trivial —
  pick a span, write the colspan class, done.
- The "TopNav / SideNav are easy to underspecify" callout (§7.5).
  Saved the v1 mistake from recurring.
- The brand-tokens balance rule (§7.2.1, 12–18 tokens). Landed v2
  at 17 (6 display + 2 displayItalic + 4 prose + 3 meta + 2 special).
  Felt right.

---

## Aside: file-name churn

The skill renamed `grid.html` → `layouts.html` and introduced a
new `grid.html` for the column-grid spec. v1 used the old name.
v2 updated. The change is the right call (the names were
misleading), but next time the skill changes a deliverable file
name, the corresponding worked-example folders should be updated
in the same commit so they don't ship the old shape as a
"reference."

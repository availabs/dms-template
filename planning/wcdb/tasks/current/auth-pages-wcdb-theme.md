# Auth pages on the WCDB theme — login first

**Project:** WCDB · **Topic:** themes · **Status:** PHASE 2 DONE, PHASE 3 BLOCKED on the live write (needs the user's go-ahead in-session) · **Started:** 2026-09-12

## Objective

Make the wcdb site's sign-in flow look like WCDB. Today `/auth/login` renders the
`@availabs/dms` auth pattern's **blue base defaults** on a white pane with an "Admin"
sidebar (`scratchpad/wcdb/auth/login-before-2026-09-12.png`), because the auth pattern
row carries no theme at all. The work is in three moves, in order:

1. **Inventory** which auth pages exist and what each one renders — done below.
2. **Design** them in the WCDB design system (login already has a mockup; the rest do not).
3. **Theme** them: point the auth pattern at `wcdb`, add the `auth` styles the pattern
   asks for, and translate the mockups onto the theme keys the fixed components read.

Login is the page that matters most; the others must be on-brand but can be plain.

## Skills to read first

- `src/dms/skills/implementing-an-auth-login-page.md` — the exact recipe (surface the
  components read, the `selectedTheme` gotcha, the key-gated slots, the boundary).
- `src/dms/skills/translating-design-system-to-dms-theme.md` — tokens → theme keys.
- `src/dms/skills/designing-a-dms-design-system.md` §7 — the mockup deliverable rules
  (`ds-nav.js` registration, shared CSS, the text-variation rule, `patterns.html`).
- `src/dms/skills/managing-design-system-icons.md` — if a mockup needs a new glyph.

## Phase 0 — Inventory — DONE 2026-09-12

### The pattern

| | |
|---|---|
| Auth pattern row | id **1471742**, `pattern_type: auth`, `base_url: "auth"`, `subdomain: "*"`, name "Auth" |
| Its theme | **none** — the row has no `theme` key, so `getPatternTheme` falls back to the library defaults. This alone explains the blue login. |
| Reference for the fix | the page pattern `wcdb_main` (1471744) carries `theme: { selectedTheme: "wcdb", layout: { options: { topNav: {…}, sideNav: {…}, activeStyle: 0 } } }` |
| Other keys on the row | `authPermissions`, `manage_url` (value not yet read — decides whether the manage pages below are reachable) |

Routes come from `src/dms/packages/dms/src/patterns/auth/siteConfig.jsx` (`authConfig`).
All are **fixed React components** styled only through theme keys — there are no
sections to author.

### The pages

| Route | Component | Renders | Design exists? |
|---|---|---|---|
| `/auth/login` | `pages/authLogin.jsx` | title (or kicker/headline/subtitle block), Email, Password with inline **Forgot?** on the label row, error strip, **Sign In** button, "Don't have an account? Sign up" prompt (hidden when `disable_signup`), optional divider / SSO / utility-link row | **Yes** — `pages/login.html` |
| `/auth/signup` | `pages/authSignup.jsx` | "Sign Up" / "Create Account": Email, Password, Verify Password (+ Organization Name, Subdomain in the create-org variant); or "Sign Up Disabled — contact an administrator" when `disable_signup` | No |
| `/auth/password/forgot` | `pages/authForgotPassword.jsx` | "Reset Password": Email, **Reset** button; sends an email styled by `auth.emailTheme` + `theme.logo` | No |
| `/auth/password/reset` | `pages/authResetPassword.jsx` | "Reset Password": Email, Current Password, New Password, Verify New Password, **Reset** | No |
| `/auth/logout` | `pages/authLogout.jsx` | no UI — clears the session and redirects | n/a |
| `/auth/*` (catch-all) | inline in `siteConfig.jsx` | a bare placeholder that prints "Admin" | No — decide whether it should redirect to login instead (library change) |
| `/auth/manage/users` | `pages/authUsers.jsx` via `manageAuthConfig` + `AdminLayout` | header "Users" + **Add new**; `UI.Table` (User, Groups as editable multiselect, Created, Last Login, View As, reset password) with search inputs in the header cells; Add-user modal (email); reset-password modal | **Yes** — `pages/admin/users.html` (2026-09-12) |
| `/auth/manage/groups` | `pages/authGroups.jsx` | header "Groups" + **Add new**; `UI.Table` (Group, # Members), name searchable, editable in place; Add-group modal | **Yes** — `pages/admin/groups.html` |
| `/auth/manage/profile` | `pages/profile.jsx` | the signed-in email as a heading + a Reset Password link | **Yes** — `pages/admin/profile.html` |

### The theme surface the pages read

- **`theme.auth.authPages.sectionGroup.default.*`** — every auth form. Base keys:
  `wrapper3` (form column), `wrapper4` + `wrapper4Img` + `wrapper4ImgList` (a hero-image
  side panel — hide), `pageWrapper`, `pageTitle`, `forgotPasswordText` (forgot link AND
  the sign-up link), `actionButton` (**replaces** the Button style entirely), `actionText`,
  `prompt`. Login-only key-gated slots (render nothing unless set): `brandWrapper`/
  `brandMark(Text)`/`brandName(Text)`; `headingBlock`/`kicker(Text)`/`heading(Text)`/
  `headingAccent(Text)`/`subtitle(Text)`; `divider`/`dividerText`; `ssoButton`/
  `ssoMark(Text)`/`ssoButtonText`; `utilityWrapper`/`utilityLink`/`utilityLinks[]`.
- **`theme.field`** (FieldSet: `fieldWrapper`, `field`, `label`, `labelRow`) and
  **`theme.input`** — site-wide. wcdb already has `input` (bordered `--bg-2` box, matches
  the mockup); it has **no `field` block**, so labels are unstyled and the `<fieldset>`
  shows the browser's groove border.
- **`theme.auth.emailTheme`** (`primaryColor`, `accentColor`, `textColor`,
  `backgroundColor`) + `theme.logo.img/title` — the forgot/reset/signup emails. Emails
  cannot read CSS variables; these need literal hex from `tokens.css`.
- **Frame:** `AuthLayout` renders `<Layout activeStyle="auth" topNavActiveStyle="auth">
  <LayoutGroup activeStyle="auth">`. `getComponentTheme` resolves a string `activeStyle`
  **by style name**, falling back to `styles[0]` when no style has that name. wcdb has no
  style named `auth` in `layout`, `layoutGroup` or `topnav`, so the auth pages currently
  get the public **cutaway** (`layout.default` with its `md:grid-cols-2` childWrapper,
  `layoutGroup.content`) and the full public topnav. The `login.html` mockup even says so
  in its header comment ("WCDB's theme.js doesn't ship an `auth` LayoutGroup variant").
- The topnav's **menus** (which widgets sit left/right) are pattern config, not theme:
  `pattern.theme.layout.options.topNav.leftMenu/rightMenu`. The mockup wants logo only.
- **Not themeable today** (hardcoded in `authLogin.jsx`): the error strip
  (`text-red-500 bg-red-50`), the button's lack of an icon slot, and a remember-me
  control (no slot at all).
- **The manage pages' frame.** `AdminLayout` wraps them in `theme.auth.authPages.container`
  and a `Layout` with `navItems` Profile / Users / Groups, using the pattern's DEFAULT
  layout options — the same options the login notch reads. A sidenav rail on this
  pattern would therefore appear on the sign-in page too, so the manage pages get **no
  rail**: the three links ride in the notch (`topNav.nav: "main"`; AuthLayout passes no
  navItems, so the login notch stays empty) and the content is one left-hugging column.
  Their page-header row (`border-b-2 border-blue-400`, `text-gray-700`) is hardcoded in
  `authUsers.jsx` / `authGroups.jsx` / `profile.jsx` — a key-gated library change to land
  the drawn treatment; the Table, Input, Modal, Button and multiselect are the global
  theme's.

### The login mockup vs the component

`src/themes/wcdb/WCDB Design System/dms_design_system/pages/login.html` — a single
centred `max-w-md` column on `--page-bg`; kicker `WCDB · 90.9 FM · SUNY Albany`;
display-italic 48px headline **"Studio access."**; one-line subtitle; a `--card-bg`
18px-radius card holding mono-uppercase labels over the brand inputs, a
**Remember me** toggle + **Forgot password** row, a full-width pill **Sign in →**
button, an *or* hairline divider, **Continue with SUNY SSO**, and a hairline-topped
"New here? **Request studio access**" line; below the card a mono
`Privacy · Terms · © 1977–2026 WCDB` row. No inverted footer.

| Mockup element | Component slot | Fit |
|---|---|---|
| kicker / headline / subtitle | `kicker(Text)`, `heading(Text)`, `subtitle(Text)` in `headingBlock` | direct |
| card around the form | `pageWrapper` | direct (keep the LayoutGroup `auth` style borderless — no double card) |
| mono labels | `field.label` | direct (site-wide) |
| inputs | `theme.input` | already matches |
| Forgot link in a row with Remember me | forgot renders **inline on the password label row** (`labelAccessory`) | **mismatch** — redraw the mockup with the link on the label row, or file a BC slot task in `src/dms/planning/` |
| Remember me toggle | none | **no slot** — drop from the mockup (the session is a stored JWT anyway) or file a slot task |
| Sign in → with arrow | `actionButton` + `actionText` (text only) | drop the glyph, or slot task |
| or-divider + SSO | `divider`, `ssoButton`… | keys exist, but **no SSO provider is wired** (the button shows "not available yet") — keep commented in the theme, as TransportNY does |
| "New here? Request studio access" | `prompt` + `forgotPasswordText` (only when signup is enabled) or `utilityLinks` | needs the signup decision below |
| Privacy · Terms · © row | `utilityWrapper` / `utilityLinks` | direct |
| error state | hardcoded red strip | not themeable — flag; optional BC key task |

## Decisions — recorded 2026-09-12

- **No SSO.** The station has no single sign-on; the divider / SSO block is out of the
  mockup and the theme leaves `divider` / `ssoButton` unset.
- **No "Request studio access" line.** Removed.
- **Remember me: deferred.** No slot; revisit only if asked.
- **Redirect after login: default behaviour** — the page the user came from
  (`location.state.from`), else `/` (`defaultRedirectUrl`). No change.
- **Self sign-up: left as it is** (enabled on the pattern). The "Sign up" prompt is real
  and the signup mockup reflects it. `disable_signup: true` on 1471742 hides the prompt
  and turns `/auth/signup` into the disabled notice — the station's call.
- **Manage pages are in scope** (users / groups / profile), designed without a rail for
  the reason under "The manage pages' frame".

## Open decision (was: asked before Phase 1)

1. **Self-signup on or off?** Staff accounts are provisioned, so the recommendation is
   `disable_signup: true` on the pattern: `/auth/signup` then shows "Sign Up Disabled" and
   the login prompt hides "Sign up". "Request studio access" becomes a `utilityLinks`
   entry — pointing where? (`mailto:`, `/station_info`, a form?)
2. **SSO**: keep the SUNY SSO button in the mockup as a future state, but leave it out of
   the live theme until a provider exists.
3. **Remember me**: drop, or ask for a library slot.
4. **Where does a successful login land?** (`defaultRedirectUrl` in the auth context —
   check what wcdb sets; the admin `/admin` pattern is the likely target.)
5. Is `manage_url` set on 1471742? If so, users/groups/profile are in scope too.

## Phase 1 — Designs — IN REVIEW (rendered to `scratchpad/wcdb/auth/mockups/`)

- [x] `pages/login.html` reconciled with the slot table: kicker / headline / subtitle
      INSIDE the card (the component renders everything in one `pageWrapper`); forgot
      link on the password label row; remember-me and the arrow glyph out; no SSO; the
      card ends with the sign-up prompt and "← Back to WCDB"; footer meta is a single
      © line (Privacy / Terms pages do not exist). Notch shows logo + mode toggle only.
- [x] `pages/auth-forgot.html`, `pages/auth-reset.html`, `pages/auth-signup.html` — title
      (`pageTitle` fallback), fields, button; signup adds the "Already have an account?"
      prompt. No kicker: only login has that slot.
- [x] `pages/admin/users.html`, `pages/admin/groups.html`, `pages/admin/profile.html` —
      notch with Profile · Users · Groups + account disc + toggle, left-hugging column,
      page header (breadcrumb, display-italic title, count, Add new pill), card table,
      Add-user dialog drawn open. Header row treatment is the library-change ask.
- [x] All seven registered in `ds-nav.js`; `node scripts/verify-nav.mjs` passes.
- [x] `patterns.html` "10 — Auth login" block redrawn to the reconciled login.
- [ ] Email colours: note in `theme.html` colour section (light literals for
      `emailTheme`) — small, do with Phase 2.
- [x] Sign-off from the user (2026-09-12): no SSO, no request-access line, manage pages in scope.

## Phase 2 — Theme files — DONE 2026-09-12

- [x] `src/themes/wcdb/auth.theme.js` — `authPages.sectionGroup.default.*` (card, kicker /
      heading / subtitle, forgot link, pill submit, prompt with hairline link, utility row,
      station-red notices), `authPages.manage.*` (the users / groups / profile chrome), `authPages.container`
      / `landing`, `userMenu.*`, `emailTheme` (light-palette literals). `divider` / `sso*`
      deliberately absent.
- [x] `wcdb_theme.js`: `auth` import + key; new **`field`** block (site-wide — no fieldset
      border, mono eyebrow labels, `labelRow`); `layout` style `auth` (one column, no cutaway
      grid); `layoutGroup` style `auth` (pane clears the notch, centres, `max-w-md`).
      Appended after the existing styles so `activeStyle: 0/1` pages are untouched.
- [x] Library prerequisite landed first: `src/dms/planning/tasks/completed/auth-pages-themeable-chrome.md`
      — the manage pages' header row, notices and account menu now read theme keys, defaults
      byte-identical (login screenshot `cmp`-equal before/after).
- [ ] Light and dark both work — verify after Phase 3 (the pages cannot pick the theme up
      until the pattern points at it).

## Phase 3 — Pattern config (live server; needs the user's explicit go-ahead, as on 2026-09-12)

- [ ] Set on pattern 1471742: `theme: { selectedTheme: "wcdb", layout: { options: {
      topNav: { size: "compact", _replace: ["leftMenu","rightMenu"], leftMenu: [{ type:
      "Logo" }], rightMenu: [{ type: "ThemeModeToggle" }] }, sideNav: { size: "none",
      _replace: ["topMenu","bottomMenu"], topMenu: [], bottomMenu: [] } } } }` — copied
      from 1471744, minus the nav widgets. Use the CLI (`dms raw get 1471742` first, then
      `dms pattern update` / `raw update` with the merged `data`), never a hand-built
      Falcor call.
- [ ] `layout.options.activeStyle: 1` (the `app` layout) so the manage pages get the
      single admin column; login is unaffected (AuthLayout asks for `auth` by name).
      `topNav.nav: "main"` so AdminLayout's navItems land in the notch.
- [ ] `disable_signup` — only if the station decides to close self sign-up.
- [ ] Mint / delete the token as in `wcdb-live-writes` memory: three separate calls.

## Phase 4 — Verify

- [ ] `node scripts/card-shot.mjs --name login --mockup ".../pages/login.html"
      --mockup-sel '[data-dms-section="card:login-form"]' --live
      http://localhost:5173/auth/login --live-sel form --out scratchpad/wcdb/auth`
      (signed out is fine). Then the same for forgot / reset / signup.
- [ ] Read the live form's `class` attribute: if it is still the
      `patterns/auth/defaultTheme.js` string, the pattern isn't on `wcdb` (skill §6).
- [ ] 390px and 1440px; light and dark.
- [ ] A real sign-in still works (token stored, redirect lands where decision 4 says);
      a wrong password shows the error strip legibly on the dark card.
- [ ] No regression on the public pages from the new `field` block or the `auth`-named
      styles (they resolve by name, so existing `activeStyle: 0` pages are untouched).

## Files requiring changes

- `src/themes/wcdb/WCDB Design System/dms_design_system/pages/login.html` (reconcile),
  `pages/auth-forgot.html`, `pages/auth-reset.html`, `pages/auth-signup.html` (new),
  `ds-nav.js`, `patterns.html`, `foundations.html` (email swatch)
- `src/themes/wcdb/auth.theme.js` (new)
- `src/themes/wcdb/wcdb_theme.js` (`auth` import, `field`, three `auth` styles)
- Live: pattern row 1471742 (`theme`, `disable_signup`)
- `pages/admin/users.html`, `pages/admin/groups.html`, `pages/admin/profile.html` (new)
- `auth.theme.js` also carries `authPages.container` (clears the notch on manage pages)
- Library escalations, each a separate BC task under `src/dms/planning/`: **themeable
  page-header row on the manage pages** (needed for the drawn treatment), themeable
  error strip, `/auth/*` catch-all → login; deferred: remember-me slot, button icon slot.

## Testing checklist

- [ ] `/auth/login` matches `login.html` within the slot boundary, both modes, both widths
- [ ] `/auth/signup`, `/auth/password/forgot`, `/auth/password/reset` on-brand
- [ ] Sign-in round trip works; error state legible
- [ ] Public home page and admin pages unchanged (spot-check with the cdp screenshot script)

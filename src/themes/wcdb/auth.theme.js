// WCDB auth pages — the theme surface the auth pattern's FIXED components read
// (login / signup / forgot / reset, the manage pages, the account menu). Design:
// `WCDB Design System/dms_design_system/pages/login.html`, `auth-*.html`,
// `admin/users.html`, `admin/groups.html`, `admin/profile.html`. Recipe:
// `src/dms/skills/implementing-an-auth-login-page.md`.
//
// Deep-merges over `patterns/auth/defaultTheme.js` via the pattern's
// `selectedTheme: "wcdb"` (pattern 1471742). Keys not set here keep the
// library default — which is why `divider` / `sso*` are simply absent: the
// station has no single sign-on, and the component renders that block only
// when the key exists.

const EYEBROW = "font-[family-name:var(--font-mono)] text-[11px] tracking-[0.12em] uppercase text-[color:var(--ink-3)]";
const META = "font-[family-name:var(--font-mono)] text-[10px] tracking-[0.12em] uppercase text-[color:var(--ink-4)]";
const GHOST_LINK =
  "inline-flex items-center gap-1.5 font-[family-name:var(--font-mono)] text-[10px] tracking-[0.10em] uppercase " +
  "text-[color:var(--ink-3)] hover:text-[color:var(--ink-1)] border-b border-transparent hover:border-[var(--line-3)] pb-0.5 transition-colors cursor-pointer";
const PILL_BUTTON =
  "inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[var(--ink-1)] text-[color:var(--page-bg)] " +
  "font-[family-name:var(--font-sans)] text-[13px] font-medium whitespace-nowrap hover:opacity-90 transition-opacity cursor-pointer";

export const authTheme = {
  authPages: {
    // AdminLayout's outer wrapper (manage pages only). The notch is fixed at
    // the top; this keeps the page header from starting under it.
    container: "pt-14",
    // The `/auth/*` placeholder.
    landing: "pt-20 px-6 " + EYEBROW,

    sectionGroup: {
      default: {
        // AuthLayout: wrapper3 wraps the form column; wrapper4 is a hero-image
        // panel the design does not have.
        wrapper3: "w-full",
        wrapper4: "hidden",

        // The card. The component renders its whole page inside this one
        // element, so the kicker / headline / subtitle live in the card too.
        pageWrapper: "w-full flex flex-col gap-4 rounded-[18px] bg-[var(--card-bg)] p-8",

        // Title block (login only — setting `headingText` switches it on).
        headingBlock: "flex flex-col items-center text-center mb-2",
        kicker: "font-[family-name:var(--font-mono)] text-[11px] tracking-[0.16em] uppercase text-[color:var(--ink-3)]",
        kickerText: "WCDB · 90.9 FM · SUNY Albany",
        heading: "mt-5 font-[family-name:var(--font-display)] italic text-[44px] leading-[1.0] tracking-[-0.03em] text-[color:var(--ink-1)] m-0",
        headingText: "Studio access.",
        subtitle: "mt-3 font-[family-name:var(--font-sans)] text-[15px] leading-[1.4] tracking-[-0.01em] text-[color:var(--ink-2)] max-w-[320px]",
        subtitleText: "Sign in to manage your show, post spins, and edit the schedule.",
        // The fallback title on signup / forgot / reset (their components have
        // no heading slots): the component's own string, display italic.
        pageTitle: "text-center font-[family-name:var(--font-display)] italic text-[32px] leading-[1.02] tracking-[-0.02em] text-[color:var(--ink-1)] mb-2",

        // The forgot link (on the password label row) AND the sign-up link.
        forgotPasswordText: EYEBROW + " hover:text-[color:var(--ink-1)] transition-colors",

        // Submit. `UI.Button` treats `className` as a replacement, so this is
        // the whole button; the label sits in `actionText`.
        actionButton:
          "mt-2 w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-[var(--ink-1)] " +
          "hover:scale-[1.01] active:scale-100 transition-transform cursor-pointer",
        actionText: "font-[family-name:var(--font-sans)] text-[14px] font-medium text-[color:var(--page-bg)]",

        // "Don't have an account? Sign up" — rendered only while the pattern
        // allows self sign-up. The link inside gets the hairline underline.
        prompt:
          "mt-4 pt-5 border-t border-[var(--line-1)] flex justify-center gap-2 " + EYEBROW + " " +
          "[&_a]:text-[color:var(--ink-1)] [&_a]:border-b [&_a]:border-[var(--line-2)] [&_a]:pb-0.5 [&_a]:hover:border-[var(--line-3)] [&_a]:transition-colors",

        // The way back out.
        utilityWrapper: "mt-2 flex justify-center " + META,
        utilityLink: "hover:text-[color:var(--ink-2)] transition-colors",
        utilityLinks: [{ text: "← Back to WCDB", to: "/" }],

        // Notices — the station red, on its soft tint.
        error: "rounded-[8px] bg-[var(--on-air-soft)] px-3 py-2 font-[family-name:var(--font-sans)] text-[13px] leading-[1.45] text-[color:var(--on-air)]",
        disabledNotice: "text-center font-[family-name:var(--font-sans)] text-[14px] leading-[1.5] text-[color:var(--ink-2)]",
        status: "font-[family-name:var(--font-sans)] text-[13px] text-[color:var(--on-air)]",
      },
    },

    // Users / groups / profile (`admin/users.html` &c). One left-hugging column
    // — the layoutGroup `content` style already gives the p-2 / px-4 gutters.
    manage: {
      pageWrapper: "flex flex-col gap-3 w-full max-w-[1100px] mr-auto",
      profileWrapper: "flex flex-col gap-3 w-full max-w-[1100px] mr-auto",
      // groups: header row + button side by side.
      headerOuter: "w-full flex items-start justify-between gap-6",
      headerRow: "w-full flex flex-wrap items-center justify-between gap-x-6 gap-y-3 pt-1 pb-5",
      headerTitle: "font-[family-name:var(--font-display)] italic text-[clamp(30px,3.2vw,42px)] leading-[1.0] tracking-[-0.03em] text-[color:var(--ink-1)]",
      headerAction: "shrink-0 mt-1 " + PILL_BUTTON,
      tableHeaderCell: "flex gap-3 items-center " + META,
      modalBody: "flex flex-row items-center gap-3",
      notice: "pt-6 font-[family-name:var(--font-sans)] text-[15px] text-[color:var(--ink-2)]",
      profileLink: GHOST_LINK,
    },
  },

  // The account menu in the manage pages' notch.
  userMenu: {
    avatar: "size-8 rounded-full bg-[var(--bg-3)] flex items-center justify-center text-[color:var(--ink-2)]",
    avatarIcon: "size-4",
    loginLink: "inline-flex items-center h-8 px-3 rounded-full font-[family-name:var(--font-sans)] text-[13px] font-medium text-[color:var(--ink-1)] hover:bg-[var(--accent-soft)] transition-colors",
    header: "py-2 px-1",
    headerEmail: "font-[family-name:var(--font-sans)] text-[13px] text-[color:var(--ink-1)]",
    headerGroup: "mt-0.5 font-[family-name:var(--font-mono)] text-[9px] tracking-[0.08em] uppercase text-[color:var(--ink-4)]",
    trigger: "px-1",
  },

  // Transactional emails (forgot / reset / signup). Email clients cannot read
  // CSS variables, so these are the LIGHT palette's literals from tokens.css.
  emailTheme: {
    primaryColor: "#0a0a0a",    // --ink-1 (light)
    accentColor: "#f5f5f4",     // --bg-2 (light)
    textColor: "#2a2a2a",       // --ink-2 (light)
    backgroundColor: "#fafaf9", // --page-bg (light)
  },
};

export default authTheme;

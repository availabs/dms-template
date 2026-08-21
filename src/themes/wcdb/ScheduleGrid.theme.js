// Theme for the WCDB ScheduleGrid section. Transcribed from
// dms_design_system/pages/admin/schedule.html; every colour is a token so the
// grid inverts with the admin's light/dark toggle.
//
// The grid is `52px + 7 × 1fr` with 34px rows — one hour is the minimum slot,
// so the hour is the unit. `min-w-0` on the wrapper is load-bearing: a grid
// item defaults to `min-width: auto`, and without it the week's min-content
// width propagates up the flex chain and scrolls the whole page sideways.
export const scheduleGridTheme = {
  wrapper: "w-full min-w-0",

  // ── version bar ──────────────────────────────────────────────────────────
  // z-10, not z-30: the bar only has to out-stack the grid rows it slides over.
  // Anything at or above the section chrome's own z-40 covers the section Settings
  // menu (absolutely positioned in the same stacking context) and makes the
  // section uneditable — which is exactly what z-30-over-nothing used to do.
  versionBar:
    "sticky top-[8px] z-10 mb-3 rounded-[18px] bg-[var(--card-bg)] border border-[var(--line-2)] " +
    "shadow-[var(--shadow-modal)] px-6 py-4 flex flex-wrap items-center gap-x-6 gap-y-3",
  versionGroup: "flex items-center gap-3",
  versionLabel: "font-[family-name:var(--font-mono)] text-[10px] tracking-[0.14em] uppercase text-[color:var(--ink-4)]",
  versionName: "font-[family-name:var(--font-display)] italic text-[18px] leading-none tracking-[-0.02em] text-[color:var(--ink-1)]",

  // ── version selector ─────────────────────────────────────────────────────
  // A native <select> deliberately: it is the one control that gets keyboard
  // navigation, mobile pickers and long-list scrolling for free, and the version
  // list is data, not design. `versionSelect` styles it as the display-italic
  // version name it replaces so the bar reads the same as before it was editable.
  versionSelectWrap: "relative inline-flex items-center",
  versionSelect:
    "appearance-none bg-transparent border-0 pr-6 pl-0 cursor-pointer " +
    "font-[family-name:var(--font-display)] italic text-[18px] leading-none tracking-[-0.02em] " +
    "text-[color:var(--ink-1)] focus:outline-none hover:text-[color:var(--accent)] transition-colors",
  versionSelectCaret: "pointer-events-none absolute right-0 size-[13px] text-[color:var(--ink-4)]",
  versionAction:
    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--line-2)] " +
    "font-[family-name:var(--font-mono)] text-[10px] tracking-[0.10em] uppercase text-[color:var(--ink-2)] " +
    "whitespace-nowrap hover:border-[color:var(--ink-3)] hover:text-[color:var(--ink-1)] transition-colors cursor-pointer",
  versionActionDisabled:
    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--line-1)] " +
    "font-[family-name:var(--font-mono)] text-[10px] tracking-[0.10em] uppercase text-[color:var(--ink-4)] " +
    "whitespace-nowrap cursor-not-allowed",
  versionActionIcon: "size-[12px]",
  versionMeta: "font-[family-name:var(--font-mono)] text-[9px] tracking-[0.08em] uppercase text-[color:var(--ink-4)]",
  versionLive: "inline-flex items-center gap-2 font-[family-name:var(--font-mono)] text-[10px] tracking-[0.08em] uppercase text-[color:var(--ink-2)]",
  liveDot: "wcdb-on-air-dot",
  versionActions: "flex items-center gap-2 ml-auto",
  publishButton:
    "inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[color:var(--ink-1)] text-[color:var(--page-bg)] " +
    "font-[family-name:var(--font-sans)] text-[12px] font-medium whitespace-nowrap hover:opacity-90 transition-opacity cursor-pointer",
  publishIcon: "size-[14px]",

  // ── the week card ────────────────────────────────────────────────────────
  card: "rounded-[18px] bg-[var(--card-bg)] p-6 min-w-0",
  head: "flex flex-wrap items-baseline justify-between gap-4 mb-5",
  headLeft: "flex items-baseline gap-3",
  title: "font-[family-name:var(--font-display)] italic text-[24px] leading-[1.05] tracking-[-0.03em] text-[color:var(--ink-1)] m-0",
  counts: "font-[family-name:var(--font-mono)] text-[10px] tracking-[0.10em] uppercase text-[color:var(--ink-4)] tabular-nums",
  legend: "flex items-center gap-4 font-[family-name:var(--font-mono)] text-[9px] tracking-[0.10em] uppercase text-[color:var(--ink-4)]",
  legendItem: "inline-flex items-center gap-1.5",
  swatchPlaced: "size-2.5 rounded-[3px] bg-[var(--bg-3)]",
  swatchOpen: "size-2.5 rounded-[3px] border border-dashed border-[var(--line-3)]",
  swatchNoDj: "size-2.5 rounded-[3px] bg-[var(--on-air-soft)] ring-1 ring-[rgba(255,59,47,0.35)]",

  dayHeaderRow: "grid gap-1 mb-1 pl-[52px] grid-cols-7",
  dayHeader:
    "px-2 pb-2 border-b border-[var(--line-2)] font-[family-name:var(--font-mono)] text-[10px] " +
    "tracking-[0.12em] uppercase text-[color:var(--ink-3)]",

  grid: "grid gap-1 grid-cols-[52px_repeat(7,minmax(0,1fr))] auto-rows-[34px]",
  hourCell: "pr-2 flex items-start justify-end",
  hourLabel: "font-[family-name:var(--font-mono)] text-[9px] tracking-[0.04em] text-[color:var(--ink-4)] tabular-nums leading-none pt-1",
  // Every sixth hour is brighter, so the eye can find 06:00 / 12:00 / 18:00
  // without a heavier rule across the grid.
  hourLabelMajor: "font-[family-name:var(--font-mono)] text-[9px] tracking-[0.04em] text-[color:var(--ink-3)] tabular-nums leading-none pt-1",

  openCell:
    "group rounded-[6px] border border-dashed border-[var(--line-1)] hover:border-[var(--line-3)] " +
    "hover:bg-[var(--accent-soft)] transition-colors grid place-items-center cursor-pointer",
  openCellPlus: "opacity-0 group-hover:opacity-100 transition-opacity text-[color:var(--ink-3)]",
  openCellIcon: "size-3",

  // A button centres its content by default, which floated a 4-hour block's
  // label at the block's middle instead of at its start time. items-stretch on
  // a column is what pins the label to the top of the span.
  // py-1, not py-2: a ONE-HOUR block is 34px tall, and 8px of vertical padding
  // plus the time row leaves nothing for the title — it clipped silently, so
  // the shortest blocks (the majority) showed a time and no name.
  block:
    "flex flex-col items-stretch text-left rounded-[8px] bg-[var(--bg-3)] hover:bg-[var(--bg-5)] " +
    "px-2 py-1 overflow-hidden transition-colors cursor-pointer",
  blockNoDj:
    "flex flex-col items-stretch text-left rounded-[8px] bg-[var(--on-air-soft)] ring-1 ring-[rgba(255,59,47,0.35)] " +
    "hover:bg-[var(--bg-5)] px-2 py-1 overflow-hidden transition-colors cursor-pointer",
  blockHead: "flex items-center justify-between gap-1.5",
  blockTime: "font-[family-name:var(--font-mono)] text-[9px] tracking-[0.04em] uppercase text-[color:var(--ink-3)] tabular-nums whitespace-nowrap",
  blockIcon: "text-[color:var(--ink-4)] shrink-0",
  blockIconGlyph: "size-[11px]",
  blockTitle: "font-[family-name:var(--font-sans)] text-[11px] font-medium leading-[1.15] text-[color:var(--ink-1)] truncate",
  blockNoDjLabel: "font-[family-name:var(--font-mono)] text-[8px] tracking-[0.10em] uppercase text-[var(--on-air)] mt-0.5",

  editNote: "mt-4 font-[family-name:var(--font-mono)] text-[9px] tracking-[0.08em] uppercase text-[color:var(--ink-4)]",

  // ── publish confirmation ─────────────────────────────────────────────────
  dialogOverlay: "fixed inset-0 z-[9998] bg-[var(--scrim)] flex items-start justify-center overflow-y-auto p-6",
  dialogCard:
    "w-full max-w-[520px] rounded-[18px] bg-[var(--card-bg)] border border-[var(--line-2)] " +
    "shadow-[var(--shadow-modal)] mt-[10vh] mb-10",
  dialogHead: "px-7 pt-6 pb-2",
  dialogEyebrow: "font-[family-name:var(--font-mono)] text-[10px] tracking-[0.14em] uppercase text-[color:var(--ink-3)] mb-2",
  dialogTitle: "font-[family-name:var(--font-display)] italic text-[28px] leading-[1.05] tracking-[-0.03em] text-[color:var(--ink-1)] m-0",
  dialogBody: "px-7 py-5",
  dialogPanel: "rounded-[12px] bg-[var(--bg-2)] p-4 flex flex-col gap-3",
  dialogRow: "flex items-center justify-between gap-4",
  dialogRowDivided: "flex items-center justify-between gap-4 pt-3 border-t border-[var(--line-1)]",
  dialogLabel: "font-[family-name:var(--font-mono)] text-[10px] tracking-[0.10em] uppercase text-[color:var(--ink-4)]",
  dialogValue: "font-[family-name:var(--font-mono)] text-[10px] tracking-[0.08em] uppercase text-[color:var(--ink-1)]",
  dialogValueMuted: "inline-flex items-center gap-2 font-[family-name:var(--font-mono)] text-[10px] tracking-[0.08em] uppercase text-[color:var(--ink-3)]",
  dialogWarn: "mt-4 flex items-start gap-3",
  dialogWarnIcon: "mt-0.5 size-[15px] text-[color:var(--ink-4)] shrink-0",
  dialogWarnText: "font-[family-name:var(--font-sans)] text-[13px] leading-[1.5] text-[color:var(--ink-3)] m-0",
  dialogFoot: "flex items-center justify-end gap-3 px-7 py-5 border-t border-[var(--line-1)] bg-[var(--bg-2)] rounded-b-[18px]",
  dialogCancel: "font-[family-name:var(--font-mono)] text-[10px] tracking-[0.10em] uppercase text-[color:var(--ink-3)] hover:text-[color:var(--ink-1)] transition-colors cursor-pointer",
  dialogConfirm:
    "inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[color:var(--ink-1)] text-[color:var(--page-bg)] " +
    "font-[family-name:var(--font-sans)] text-[13px] font-medium whitespace-nowrap hover:opacity-90 transition-opacity cursor-pointer",
  dialogConfirmDisabled:
    "inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--bg-3)] text-[color:var(--ink-4)] " +
    "font-[family-name:var(--font-sans)] text-[13px] font-medium whitespace-nowrap cursor-not-allowed",
  dialogConfirmIcon: "size-[14px]",

  // ── name dialog (new / duplicate version) ────────────────────────────────
  // Reuses the publish dialog's shell keys (overlay/card/head/body/foot) — same
  // modal, different body — so the two dialogs can never drift apart visually.
  nameField: "flex flex-col gap-2",
  nameLabel: "font-[family-name:var(--font-mono)] text-[10px] tracking-[0.14em] uppercase text-[color:var(--ink-4)]",
  nameInput:
    "w-full px-4 py-3 rounded-[12px] bg-[var(--bg-2)] border border-[var(--line-2)] " +
    "font-[family-name:var(--font-sans)] text-[15px] text-[color:var(--ink-1)] " +
    "placeholder:text-[color:var(--ink-4)] focus:outline-none focus:border-[color:var(--ink-3)] transition-colors",
  nameHint: "font-[family-name:var(--font-sans)] text-[13px] leading-[1.5] text-[color:var(--ink-3)] m-0 mt-3",
  nameError: "font-[family-name:var(--font-sans)] text-[13px] leading-[1.5] text-[color:var(--live)] m-0 mt-3",
}

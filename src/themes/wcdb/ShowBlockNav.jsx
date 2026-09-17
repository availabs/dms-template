import React from "react"
import { ThemeContext, getComponentTheme } from "../../dms/packages/dms/src/ui/useTheme"
import { ComponentContext, PageContext } from "../../dms/packages/dms/src/patterns/page/context"
import { showBlockNavTheme } from "./ShowBlockNav.theme"
import {
  DEFAULT_TZ, DEFAULT_BLOCK_MINUTES,
  normalizeAirings, resolveBlock, prevBlock, nextBlock,
  isoToken, parseInstant, formatBlockRange,
} from "./ShowBlockNav.utils"

// WCDB ShowBlockNav — "which block of the playlist am I looking at, and how
// do I step through them".
//
// The section is dataWrapper-bound to the schedule (joined to shows + DJs)
// and renders nothing of the rows themselves: it reads the WEEK, finds the
// block that contains the page's `from` instant (or now, when the URL has
// none), and publishes that block's edges as the `from`/`to` page variables
// through PageContext. The spins Card below filters on those two variables
// with ordinary `gte`/`lt` leaves, so "the playlist is always within the
// selected show's time bounds" is a property of the page config, not of
// this component.
//
// THE PAGE OWNS THE URL (creating-page-section-components.md). All writes go
// through `updatePageStateFilters`; the only write that is not a click is the
// mount-time normalisation, guarded so it never re-emits what the page
// already holds — a hand-typed `?from=` mid-show is snapped to the show's
// start once and then left alone.

const readVar = (pageState, key) => {
  const f = (pageState?.filters || []).find((x) => x.searchKey === key)
  const v = f?.values
  return Array.isArray(v) ? v[0] : v
}

export const ShowBlockNavView = () => {
  const { theme: themeFromContext = {}, UI } = React.useContext(ThemeContext) || {}
  const t = { ...showBlockNavTheme, ...getComponentTheme(themeFromContext, "showBlockNav") }
  const Icon = UI?.Icon
  // The dataWrapper hands a section its state through ComponentContext, not
  // as a prop (same as Card / ScheduleGrid).
  const { state = {} } = React.useContext(ComponentContext) || {}
  const { pageState, updatePageStateFilters } = React.useContext(PageContext) || {}

  const display = React.useMemo(() => state.display || {}, [state.display])
  const tz = display.tz || DEFAULT_TZ
  const blockMinutes = Number(display.blockMinutes) || DEFAULT_BLOCK_MINUTES
  const fromKey = display.fromParamKey || "from"
  const toKey = display.toParamKey || "to"
  // `inset` — an authorable CSS padding string for the strip, emitted INLINE so
  // it beats the theme wrapper's classes. The theme's padding is tuned for
  // sitting under a list title; a section that IS the card's top row (the
  // admin log) needs the card's own inner gutter instead, and a section's
  // `padding` cannot supply it — that is the page gutter outside the box.
  const insetStyle = display.inset ? { padding: display.inset } : undefined
  const opts = React.useMemo(() => ({ tz, blockMinutes }), [tz, blockMinutes])

  const cols = React.useMemo(() => ({
    id: display.idField || "airing_id",
    showId: display.showIdField || "show_id",
    day: display.dayField || "day",
    start: display.startField || "start",
    end: display.endField || "end",
    title: display.titleField || "name",
    dj: display.djField || "on_air_name",
    department: display.departmentField || "department",
  }), [display])

  const airings = React.useMemo(() => normalizeAirings(state.data, cols), [state.data, cols])

  // A minute tick so the live pill and the Next arrow follow the clock.
  const [now, setNow] = React.useState(() => new Date())
  React.useEffect(() => {
    let id
    const schedule = () => {
      id = setTimeout(() => { setNow(new Date()); schedule() }, 60_000 - (Date.now() % 60_000) + 50)
    }
    schedule()
    return () => clearTimeout(id)
  }, [])

  // The dataWrapper exposes no loading flag to the section, so "no rows yet"
  // and "no schedule" look the same. Wait briefly for rows before treating
  // the week as empty, so the first block written is not an automation slice
  // that gets rewritten a moment later when the schedule lands.
  const [settled, setSettled] = React.useState(false)
  React.useEffect(() => {
    const id = setTimeout(() => setSettled(true), 2500)
    return () => clearTimeout(id)
  }, [])
  const ready = airings.length > 0 || settled

  const pageFrom = readVar(pageState, fromKey)
  const pageTo = readVar(pageState, toKey)
  const anchor = React.useMemo(() => parseInstant(pageFrom) || now, [pageFrom, now])

  const block = React.useMemo(
    () => (ready ? resolveBlock(airings, anchor, opts) : null),
    [ready, airings, anchor, opts],
  )
  const blockFrom = block ? isoToken(block.start) : null
  const blockTo = block ? isoToken(block.end) : null

  const publish = React.useCallback((b) => {
    if (!updatePageStateFilters || !b) return
    updatePageStateFilters([
      { searchKey: fromKey, values: isoToken(b.start) },
      { searchKey: toKey, values: isoToken(b.end) },
    ])
  }, [updatePageStateFilters, fromKey, toKey])

  // Normalise the URL onto the block's edges — once, and only when it differs.
  React.useEffect(() => {
    if (!block || !blockFrom || !blockTo) return
    if (pageFrom === blockFrom && pageTo === blockTo) return
    publish(block)
  }, [block, blockFrom, blockTo, pageFrom, pageTo, publish])

  if (!block) {
    return (
      <div className={t.wrapper} style={insetStyle} data-show-block-nav="pending">
        <span className={t.pending}>Loading the schedule…</span>
      </div>
    )
  }

  const isLive = block.start.getTime() <= now.getTime() && now.getTime() < block.end.getTime()
  const isPast = block.end.getTime() <= now.getTime()
  const prev = prevBlock(airings, block, opts)
  const next = isPast ? nextBlock(airings, block, opts) : null
  const showNow = !isLive
  const isShow = block.kind === "show"
  const a = block.airing

  const eyebrow = isShow ? (display.showEyebrow ?? "Show") : (display.automationEyebrow ?? "Automation")
  const title = isShow ? (a.title || "Untitled show") : (display.automationTitle ?? "Automation")
  const metaBits = isShow
    ? [a.dj ? `w/ ${a.dj}` : null, a.department || null].filter(Boolean)
    : [display.automationMeta ?? "Music on rotation"]

  // A render helper, not a nested component: a component declared inside
  // render is a new type every render and React would remount both arrows on
  // every minute tick.
  const renderArrow = (dir, target, label) => {
    const disabled = !target
    return (
      <button
        type="button"
        className={disabled ? t.arrowDisabled : t.arrow}
        aria-label={label}
        disabled={disabled}
        onClick={disabled ? undefined : () => publish(target)}
      >
        {Icon
          ? <Icon icon={dir === "prev" ? "ChevronLeft" : "ChevronRight"} className={t.arrowIcon} />
          : <span aria-hidden="true">{dir === "prev" ? "\u2039" : "\u203a"}</span>}
      </button>
    )
  }

  return (
    <div className={t.wrapper} style={insetStyle} data-show-block-nav={block.kind} data-block-from={blockFrom} data-block-to={blockTo}>
      {renderArrow("prev", prev, "Previous block")}
      <div className={t.body}>
        <div className={t.eyebrowRow}>
          {isLive ? (
            <span className={t.livePill}>
              <span aria-hidden="true" className={t.liveDot} />
              {display.liveLabel ?? "On air"}
            </span>
          ) : null}
          <span className={t.eyebrow}>{eyebrow}</span>
          <span className={t.eyebrow} aria-hidden="true">·</span>
          <span className={t.range}>{formatBlockRange(block.start, block.end, tz)}</span>
        </div>
        <div className={t.title} title={title}>{title}</div>
        {metaBits.length ? <div className={t.meta}>{metaBits.join(" · ")}</div> : null}
      </div>
      {showNow ? (
        <button type="button" className={t.nowLink} onClick={() => publish(resolveBlock(airings, now, opts))}>
          {display.nowLabel ?? "Now"}
          {Icon ? <Icon icon="ArrowRight" className="size-[12px]" /> : null}
        </button>
      ) : null}
      {renderArrow("next", next, "Next block")}
    </div>
  )
}

export const ShowBlockNavEdit = ShowBlockNavView

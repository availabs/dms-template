import React from "react"
import { ThemeContext, getComponentTheme } from "../../dms/packages/dms/src/ui/useTheme"
import { ComponentContext, PageContext } from "../../dms/packages/dms/src/patterns/page/context"
import { scheduleGridTheme } from "./ScheduleGrid.theme"
import { HOURS, dayLabels, hourLabel, toBlocks } from "./ScheduleGrid.utils"

// WCDB ScheduleGrid — the week, all 24 hours of it, as one grid.
//
// WHY THIS IS NOT A CONFIGURED CARD. A Card renders one card per ROW; this
// renders a 7×24 lattice of which the rows are a sparse overlay, and its
// primary affordance is the EMPTY cell — the hour with no row behind it. 663 of
// 769 legacy shows have no time, and you cannot fill a gap you cannot see, so
// "draw every hour whether or not it has data" is the design. No arrangement of
// cells over a row set expresses that, which is the bar `creating-page-section-
// components.md` sets for a new section type.
//
// POINT AND CLICK, NO DRAGGING. A placed block opens the edit modal; an empty
// hour opens the add modal already knowing its day and hour. Both are published
// as ACTION PARAMS, which is what `modal-section-group.md` modals open on — so
// the modals themselves stay ordinary authored section groups that a human can
// edit, rather than markup buried in this file.
//
// The component owns no data of its own: it is dataWrapper-bound to the
// schedule source joined to shows, and renders `state.data`.

function PublishDialog({ t, open, onClose, incoming, outgoing, rowCount, canPublish, blockedReason, Icon }) {
  if (!open) return null
  return (
    <div className={t.dialogOverlay} onClick={onClose}>
      <div className={t.dialogCard} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Publish schedule">
        <div className={t.dialogHead}>
          <div className={t.dialogEyebrow}>Go live</div>
          <h3 className={t.dialogTitle}>{`Publish ${incoming.name}?`}</h3>
        </div>
        <div className={t.dialogBody}>
          <div className={t.dialogPanel}>
            <div className={t.dialogRow}>
              <span className={t.dialogLabel}>Public site shows</span>
              <span className={t.dialogValueMuted}>{outgoing ? `${outgoing.name} · ${outgoing.rowCount} airings` : "nothing yet"}</span>
            </div>
            <div className={t.dialogRowDivided}>
              <span className={t.dialogLabel}>Will show</span>
              <span className={t.dialogValue}>{`${incoming.name} · ${rowCount} airings`}</span>
            </div>
          </div>
          {/* The empty-version refusal is the reason this dialog exists: a
              published empty view takes the public schedule down silently, and
              wcdb_schedule v2 is an empty view today. */}
          {rowCount === 0 ? (
            <div className={t.dialogWarn}>
              {Icon ? <Icon icon="Alert" className={t.dialogWarnIcon} /> : null}
              <p className={t.dialogWarnText}>
                This version has no airings. Publishing it would empty the public schedule, so it cannot be published.
              </p>
            </div>
          ) : blockedReason ? (
            <div className={t.dialogWarn}>
              {Icon ? <Icon icon="Alert" className={t.dialogWarnIcon} /> : null}
              <p className={t.dialogWarnText}>{blockedReason}</p>
            </div>
          ) : null}
        </div>
        <div className={t.dialogFoot}>
          <button type="button" className={t.dialogCancel} onClick={onClose}>Cancel</button>
          <button type="button" className={rowCount === 0 || !canPublish ? t.dialogConfirmDisabled : t.dialogConfirm} disabled={rowCount === 0 || !canPublish}>
            {Icon ? <Icon icon="Broadcast" className={t.dialogConfirmIcon} /> : null}
            {`Publish ${incoming.short}`}
          </button>
        </div>
      </div>
    </div>
  )
}

export const ScheduleGridView = ({ isEdit }) => {
  const { theme: themeFromContext = {}, UI } = React.useContext(ThemeContext) || {}
  const t = { ...scheduleGridTheme, ...getComponentTheme(themeFromContext, "scheduleGrid") }
  const Icon = UI?.Icon
  // The dataWrapper hands a section its state through ComponentContext, NOT as
  // a prop — a `state` prop is always undefined, which renders as a bound
  // section with no rows (every hour open, "unbound" version) rather than as an
  // error. Card.jsx reads it the same way.
  const { state = {} } = React.useContext(ComponentContext) || {}
  const { setActionParam } = React.useContext(PageContext) || {}
  const [publishOpen, setPublishOpen] = React.useState(false)

  const display = React.useMemo(() => state.display || {}, [state.display])
  // Memoized so it can be a real dependency of the blocks memo below — rebuilt
  // per render it would be a new object every time and defeat it.
  const cols = React.useMemo(() => ({
    id: display.idField || "airing_id",
    day: display.dayField || "day",
    start: display.startField || "start",
    end: display.endField || "end",
    title: display.titleField || "name",
    icon: display.iconField || "icon",
    dj: display.djField || "dj_id",
  }), [display])
  const labels = dayLabels(display.weekStartsOn)
  const blocks = React.useMemo(() => toBlocks(state.data, cols), [state.data, cols])

  // An hour is occupied if any block covers it, so "open" is the complement of
  // what is drawn rather than a second source of truth.
  const occupied = React.useMemo(() => {
    const set = new Set()
    for (const b of blocks) for (let h = b.start; h < b.start + b.span; h++) set.add(`${b.day}:${h}`)
    return set
  }, [blocks])

  const openCount = 7 * 24 - occupied.size

  const publish = (key, value) => {
    // The page owns the URL; a section publishes through PageContext or not at
    // all. These are transient interaction params, so they are action params —
    // they open a modal, they are not worth bookmarking.
    if (setActionParam) setActionParam(key, value)
  }

  const version = {
    name: state.externalSource?.view_name ? `Version ${state.externalSource.view_name}` : "This version",
    short: state.externalSource?.view_id ? `v${state.externalSource.view_id}` : "",
  }
  const live = display.liveVersion || null

  return (
    <div className={t.wrapper}>
      {/* ── version bar ─────────────────────────────────────────────────── */}
      <div className={t.versionBar}>
        <div className={t.versionGroup}>
          <span className={t.versionLabel}>Editing</span>
          <span className={t.versionName}>{version.name}</span>
          <span className={t.versionMeta}>{state.externalSource?.view_id ? `v${state.externalSource.view_id}` : "unbound"}</span>
        </div>
        <div className={t.versionGroup}>
          <span className={t.versionLabel}>Live now</span>
          <span className={t.versionLive}>
            <span className={t.liveDot} />
            {live ? live : "not set"}
          </span>
        </div>
        <div className={t.versionActions}>
          <button type="button" className={t.publishButton} onClick={() => setPublishOpen(true)}>
            {Icon ? <Icon icon="Broadcast" className={t.publishIcon} /> : null}
            Publish
          </button>
        </div>
      </div>

      {/* ── the week ────────────────────────────────────────────────────── */}
      <div className={t.card}>
        <div className={t.head}>
          <div className={t.headLeft}>
            <h2 className={t.title}>{display.gridTitle || "The week"}</h2>
            <span className={t.counts}>{`${blocks.length} airings placed · ${openCount} hours open`}</span>
          </div>
          <div className={t.legend}>
            <span className={t.legendItem}><span className={t.swatchPlaced} /> placed</span>
            <span className={t.legendItem}><span className={t.swatchOpen} /> open — click to add</span>
            <span className={t.legendItem}><span className={t.swatchNoDj} /> needs a DJ</span>
          </div>
        </div>

        {/* Day header sits outside the grid so the grid can scroll under it. */}
        <div className={t.dayHeaderRow}>
          {labels.map((d) => <div key={d} className={t.dayHeader}>{d}</div>)}
        </div>

        <div className={t.grid}>
          {HOURS.map((h) => (
            <div key={`hr-${h}`} className={t.hourCell} style={{ gridColumn: 1, gridRow: h + 1 }}>
              <span className={h % 6 === 0 ? t.hourLabelMajor : t.hourLabel}>{hourLabel(h)}</span>
            </div>
          ))}

          {/* Every hour of every day is drawn. The empty ones are the point. */}
          {labels.map((_, dayIdx) =>
            HOURS.filter((h) => !occupied.has(`${dayIdx}:${h}`)).map((h) => (
              <button
                key={`open-${dayIdx}-${h}`}
                type="button"
                className={t.openCell}
                style={{ gridColumn: dayIdx + 2, gridRow: h + 1 }}
                title={`Add a show — ${labels[dayIdx]} ${hourLabel(h)}`}
                onClick={() => publish(display.addParamKey || "add_airing", `${dayIdx}|${h}`)}
              >
                <span className={t.openCellPlus}>{Icon ? <Icon icon="Plus" className={t.openCellIcon} /> : "+"}</span>
              </button>
            ))
          )}

          {blocks.map((b) => (
            <button
              key={`block-${b.id ?? `${b.day}-${b.start}`}`}
              type="button"
              className={b.dj ? t.block : t.blockNoDj}
              style={{ gridColumn: b.day + 2, gridRow: `${b.start + 1} / span ${b.span}` }}
              title={`${b.title || "Untitled show"} · ${b.label}`}
              onClick={() => publish(display.editParamKey || "edit_airing", String(b.id ?? ""))}
            >
              <span className={t.blockHead}>
                <span className={t.blockTime}>{b.label}</span>
                {b.icon && Icon ? <span className={t.blockIcon}><Icon icon={b.icon} className={t.blockIconGlyph} /></span> : null}
              </span>
              <span className={t.blockTitle}>{b.title || "Untitled show"}</span>
              {b.dj ? null : <span className={t.blockNoDjLabel}>needs a DJ</span>}
            </button>
          ))}
        </div>

        {isEdit ? (
          <p className={t.editNote}>
            Which version this grid edits is its data binding — set the source view in Settings → Data.
          </p>
        ) : null}
      </div>

      <PublishDialog
        t={t}
        Icon={Icon}
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        incoming={version}
        outgoing={live ? { name: live, rowCount: display.liveRowCount ?? "?" } : null}
        rowCount={blocks.length}
        canPublish={Boolean(display.liveTargetSectionId)}
        blockedReason={
          display.liveTargetSectionId
            ? null
            : "No public section is configured to receive this version yet, so publishing has nowhere to point. Set the target section in Settings once the public schedule page is bound to this source."
        }
      />
    </div>
  )
}

export const ScheduleGridEdit = ScheduleGridView

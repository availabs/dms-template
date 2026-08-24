import React from "react"
import { ThemeContext, getComponentTheme } from "../../dms/packages/dms/src/ui/useTheme"
import { ComponentContext, PageContext, CMSContext } from "../../dms/packages/dms/src/patterns/page/context"
import { udaListViews, udaCreateView } from "../../dms/packages/dms/src/api"
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

// Name-a-version dialog. Lives INSIDE this component rather than as an authored
// section group (which is how the add/edit-airing modals work) because it has no
// data binding to author: it collects one string and hands it to a falcor call.
// A modal section group would mean a page section whose only job is to hold an
// input this component still has to read back out of the URL.
function NameVersionDialog({ t, open, mode, sourceLabel, copyFrom, rowCount, busy, error, value, onChange, onClose, onConfirm, Icon }) {
  if (!open) return null
  const duplicating = mode === "duplicate"
  return (
    <div className={t.dialogOverlay} onClick={busy ? undefined : onClose}>
      <div className={t.dialogCard} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true"
           aria-label={duplicating ? "Duplicate version" : "New version"}>
        <div className={t.dialogHead}>
          <div className={t.dialogEyebrow}>{duplicating ? "Duplicate" : "New version"}</div>
          <h3 className={t.dialogTitle}>{duplicating ? `Copy ${copyFrom || "this version"}?` : "Start a blank week"}</h3>
        </div>
        <form className={t.dialogBody} onSubmit={(e) => { e.preventDefault(); onConfirm() }}>
          <div className={t.nameField}>
            <label className={t.nameLabel} htmlFor="wcdb-version-name">Name this version</label>
            <input
              id="wcdb-version-name"
              className={t.nameInput}
              value={value}
              autoFocus
              disabled={busy}
              placeholder={duplicating ? "Fall 2026 draft" : "Spring 2027"}
              onChange={(e) => onChange(e.target.value)}
            />
          </div>
          {error
            ? <p className={t.nameError}>{error}</p>
            : (
              <p className={t.nameHint}>
                {duplicating
                  ? `${rowCount} airing${rowCount === 1 ? "" : "s"} will be copied into a new version of ${sourceLabel}. Editing the copy never touches the original.`
                  : `A new empty version of ${sourceLabel}, with the same columns and nothing scheduled. Nothing goes live until you publish it.`}
              </p>
            )}
        </form>
        <div className={t.dialogFoot}>
          <button type="button" className={t.dialogCancel} onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className={busy || !value.trim() ? t.dialogConfirmDisabled : t.dialogConfirm}
                  disabled={busy || !value.trim()} onClick={onConfirm}>
            {Icon ? <Icon icon={duplicating ? "Copy" : "Plus"} className={t.dialogConfirmIcon} /> : null}
            {busy ? "Creating\u2026" : (duplicating ? "Duplicate" : "Create")}
          </button>
        </div>
      </div>
    </div>
  )
}

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
  const { state = {}, setState } = React.useContext(ComponentContext) || {}
  const { setActionParam } = React.useContext(PageContext) || {}
  const { falcor } = React.useContext(CMSContext) || {}
  const [publishOpen, setPublishOpen] = React.useState(false)

  // ── versions ────────────────────────────────────────────────────────────
  // A "version" of the schedule is a VERSION OF THE DATASET — a DAMA view of the
  // bound source, with its own table. That is why switching versions is a rebind
  // (`externalSource.view_id`) and not a filter: the rows of a draft week live
  // somewhere the live week's query cannot reach, so a half-finished draft can
  // never leak onto the public site.
  //
  // The rebind is written into LOCAL section state. In view mode `setState` is a
  // useImmer setter that is never persisted, so picking a version is a per-session
  // choice an admin makes freely — it does not dirty the page, and it does not need
  // page-edit rights. `externalSource.view_id` is part of dataWrapper's fetch key,
  // so setting it is all that is needed to make the grid refetch.
  const srcEnv = state.externalSource?.srcEnv || state.externalSource?.env
  const sourceId = state.externalSource?.source_id
  const viewId = state.externalSource?.view_id
  const [versions, setVersions] = React.useState([])
  const [nameDialog, setNameDialog] = React.useState(null) // null | 'new' | 'duplicate'
  const [nameValue, setNameValue] = React.useState("")
  const [creating, setCreating] = React.useState(false)
  const [createError, setCreateError] = React.useState(null)
  const [reloadVersions, setReloadVersions] = React.useState(0)

  React.useEffect(() => {
    if (!falcor || !srcEnv || !sourceId) return
    let live = true
    udaListViews(falcor, { env: srcEnv, source_id: sourceId })
      .then((rows) => { if (live) setVersions(rows) })
      .catch((e) => { console.error("[ScheduleGrid] could not list versions:", e.message) })
    return () => { live = false }
  }, [falcor, srcEnv, sourceId, reloadVersions])

  const versionLabel = React.useCallback((v) => {
    if (!v) return null
    const name = v.version && String(v.version).trim()
    // `version` defaults to '1' for every DAMA view and to the view_id for ones this
    // component creates unnamed, so a purely numeric label is not a name — it reads as
    // a bare "1" in the picker. Prefix those; leave a real name ("Fall 2026") alone.
    if (!name) return `Version ${v.view_id}`
    return /^\d+$/.test(name) ? `Version ${name}` : name
  }, [])

  const switchVersion = (nextViewId) => {
    const next = Number(nextViewId)
    if (!Number.isInteger(next) || next === Number(viewId) || !setState) return
    setState((draft) => {
      if (!draft?.externalSource) return
      draft.externalSource.view_id = next
      const match = versions.find((v) => v.view_id === next)
      if (match?.version) draft.externalSource.view_name = String(match.version)
      // The previous version's rows must not linger while the refetch is in flight —
      // they would read as this version's schedule for as long as the request takes.
      draft.data = []
    })
  }

  const openNameDialog = (mode) => {
    setCreateError(null)
    setNameValue(mode === "duplicate" ? `${versionLabel(versions.find((v) => v.view_id === Number(viewId))) || "Version"} copy` : "")
    setNameDialog(mode)
  }

  const createVersion = async () => {
    if (!falcor || !sourceId || creating) return
    const label = nameValue.trim()
    if (!label) return
    setCreating(true)
    setCreateError(null)
    try {
      const newViewId = await udaCreateView(falcor, {
        env: srcEnv,
        source_id: sourceId,
        version: label,
        copy_from_view_id: nameDialog === "duplicate" ? viewId : null,
      })
      if (!newViewId) throw new Error("The server created no version")
      // Refresh the list BEFORE switching so switchVersion can find the new label.
      const rows = await udaListViews(falcor, { env: srcEnv, source_id: sourceId })
      setVersions(rows)
      setReloadVersions((n) => n + 1)
      setNameDialog(null)
      if (setState) {
        setState((draft) => {
          if (!draft?.externalSource) return
          draft.externalSource.view_id = newViewId
          draft.externalSource.view_name = label
          draft.data = []
        })
      }
    } catch (e) {
      // Surfaced in the dialog rather than a console line: the two failures a user
      // will actually hit are "not authorized" and "no version to derive a schema
      // from", and both are answerable only by the person who clicked.
      setCreateError(e?.message || "Could not create the version")
    } finally {
      setCreating(false)
    }
  }

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
          {versions.length ? (
            <span className={t.versionSelectWrap}>
              <select
                className={t.versionSelect}
                value={viewId ?? ""}
                aria-label="Which version of the schedule to edit"
                onChange={(e) => switchVersion(e.target.value)}
              >
                {/* A bound view that isn't in the list yet (first render, or a view the
                    source no longer lists) still has to be selectable, or the select
                    would silently show someone else's version. */}
                {versions.some((v) => v.view_id === Number(viewId)) ? null
                  : <option value={viewId ?? ""}>{version.name}</option>}
                {versions.map((v) => (
                  <option key={v.view_id} value={v.view_id}>{versionLabel(v)}</option>
                ))}
              </select>
              {Icon ? <Icon icon="ChevronDown" className={t.versionSelectCaret} /> : null}
            </span>
          ) : <span className={t.versionName}>{version.name}</span>}
          <span className={t.versionMeta}>{viewId ? `v${viewId}` : "unbound"}</span>
        </div>
        <div className={t.versionGroup}>
          <span className={t.versionLabel}>Live now</span>
          <span className={t.versionLive}>
            <span className={t.liveDot} />
            {live ? live : "not set"}
          </span>
        </div>
        <div className={t.versionActions}>
          <button
            type="button"
            className={falcor && sourceId ? t.versionAction : t.versionActionDisabled}
            disabled={!falcor || !sourceId}
            title={falcor && sourceId ? "Start an empty version" : "This section is not bound to an external source"}
            onClick={() => openNameDialog("new")}
          >
            {Icon ? <Icon icon="Plus" className={t.versionActionIcon} /> : null}
            New
          </button>
          <button
            type="button"
            className={falcor && sourceId && viewId ? t.versionAction : t.versionActionDisabled}
            disabled={!falcor || !sourceId || !viewId}
            title={viewId ? "Copy this version's airings into a new one" : "No version is bound to copy"}
            onClick={() => openNameDialog("duplicate")}
          >
            {Icon ? <Icon icon="Copy" className={t.versionActionIcon} /> : null}
            Duplicate
          </button>
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
            The version picker in the bar above rebinds this grid for your session only; the
            version this section OPENS on is its saved data binding (Settings → Data).
          </p>
        ) : null}
      </div>

      <NameVersionDialog
        t={t}
        Icon={Icon}
        open={Boolean(nameDialog)}
        mode={nameDialog}
        sourceLabel={state.externalSource?.name || "this schedule"}
        copyFrom={version.name}
        rowCount={blocks.length}
        busy={creating}
        error={createError}
        value={nameValue}
        onChange={setNameValue}
        onClose={() => { if (!creating) { setNameDialog(null); setCreateError(null) } }}
        onConfirm={createVersion}
      />

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

import React from "react"
import { ThemeContext, getComponentTheme } from "../../dms/packages/dms/src/ui/useTheme"
import { ComponentContext, PageContext, CMSContext } from "../../dms/packages/dms/src/patterns/page/context"
import { udaListViews, udaCreateView, udaUpdateSourceMetadata } from "../../dms/packages/dms/src/api"
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

function PublishDialog({ t, open, onClose, onConfirm, busy, progress, incoming, outgoing, rowCount, canPublish, blockedReason, Icon }) {
  if (!open) return null
  return (
    <div className={t.dialogOverlay} onClick={busy ? undefined : onClose}>
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
          {progress ? <span className={t.dialogProgress}>{progress}</span> : null}
          <button type="button" className={t.dialogCancel} onClick={onClose} disabled={busy}>Cancel</button>
          <button
            type="button"
            className={busy || rowCount === 0 || !canPublish ? t.dialogConfirmDisabled : t.dialogConfirm}
            disabled={busy || rowCount === 0 || !canPublish}
            onClick={onConfirm}
          >
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
  const { state = {}, setState, apiLoad, apiUpdate } = React.useContext(ComponentContext) || {}
  const { setActionParam, format } = React.useContext(PageContext) || {}
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

  /* Open on whatever is PUBLISHED, not on the saved binding.
   *
   * The section's stored `externalSource.view_id` is whichever version it was authored
   * against, which drifts the first time anyone publishes; opening there shows the
   * programme director a week the public site is not serving. `liveInfo` already carries
   * the answer, so the grid just follows it — once per mount, guarded by a ref so it
   * cannot fight a manual pick from the selector or bounce after a publish.
   *
   * Skipped when the public sections disagree with each other (`mixed`): there is no
   * single published version to open on, and the chip says so. */
  const didOpenOnLive = React.useRef(false)
  React.useEffect(() => {
    if (didOpenOnLive.current) return
    if (!liveInfo || liveInfo === "none") return
    didOpenOnLive.current = true
    if (display.openOnPublishedVersion === false) return
    if (liveInfo.mixed || !liveInfo.view_id) return
    if (Number(liveInfo.view_id) === Number(viewId)) return
    switchVersion(liveInfo.view_id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveInfo])

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

  /* ── publish: repoint the public page at this version ────────────────────
   *
   * "Publishing" a schedule is not a DMS page publish — it is rewriting
   * `externalSource.view_id` on the PUBLIC page's schedule sections so they read
   * this version's table instead of whichever one they were built against.
   *
   * The targets are DISCOVERED, not configured. The obvious design — an authored
   * `liveTargetSectionId` — cannot work: the public schedule page has FOUR sections
   * bound to the schedule source, and the seed mints new section ids on every run
   * (a published page keeps a separate copy of every section from its draft), so
   * any hand-recorded id is stale the next time anyone re-seeds. Instead we read
   * the target page and match on `source_id`, which is stable.
   *
   * Both `sections` (what the public site serves) and `draft_sections` (what the
   * page editor shows) are rewritten. They are SEPARATE ROWS, so leaving one
   * behind would either strand the live site on the old version or make the next
   * page-publish silently revert this one.
   */
  const targetPattern = display.liveTargetPattern || "wcdb_main"
  /* Sources whose ingest tags rows with "what was on air" and therefore have to follow a
   * publish. The playlist stream resolves each detection's show from a schedule VERSION
   * recorded in `source.metadata.schedule.view_id`; leave that behind on a publish and
   * new tracks keep being attributed to last semester's shows.
   *
   * Configured as ids rather than discovered, unlike the pages: a DAMA source id is
   * stable for the life of the source, so there is nothing here to go stale. */
  const taggingSourceIds = String(display.taggingSourceIds || "")
    .split(",").map((x) => x.trim()).filter(Boolean)
  // Optional restriction. Empty (the normal case) = every page in the pattern.
  // Kept as the raw string so it can be a statically-checkable hook dependency; the
  // array is derived inside readTargets.
  const targetPageIdList = String(display.liveTargetPageIds || display.liveTargetPageId || "").trim()
  const [liveInfo, setLiveInfo] = React.useState(null)   // {view_id, sections:[…]} | 'none'
  const [publishing, setPublishing] = React.useState(false)
  const [publishError, setPublishError] = React.useState(null)
  const [publishedNote, setPublishedNote] = React.useState(null)
  const [progress, setProgress] = React.useState(null)

  /* Load ONE row by id.
   *
   * The shape matters and is not obvious: `action: 'view'` + `params.id` alone returns
   * EVERY row of the type (all 8 pages, all 4005 sections, capped at 500) with no
   * filtering, so `[0]` is an arbitrary row — which read as "no section is bound to this
   * source" rather than as an error. `getActiveConfig` selects the child by PATH, so the
   * id has to appear in the path passed as apiLoad's second argument as well as in
   * `params`, and the `filter.options` id filter is what actually narrows the query.
   * Copied from ExportPdf.jsx, the one place in the tree that already does this right. */
  const loadById = React.useCallback(async (type, id) => {
    const res = await apiLoad({
      format: { app: format.app, type, attributes: [] },
      children: [{
        type: () => {},
        action: "view",
        filter: { stopFullDataLoad: true, options: JSON.stringify({ filter: { id: [id] } }) },
        path: "view/:id",
        params: { id },
      }],
    }, `/view/${id}`)
    return (Array.isArray(res) ? res : [res]).find((r) => String(r?.id) === String(id)) || null
  }, [apiLoad, format?.app])

  /* Every section, on every public page, bound to this schedule source.
   *
   * WHY WALK THE PAGES rather than just listing the pattern's sections and filtering:
   * `wcdb_main` has 4005 section rows of which 884 mention source 10, because a section
   * row outlives the page that referenced it — most of those are orphans no page renders.
   * Repointing them would be hundreds of pointless writes. A page's `sections` /
   * `draft_sections` arrays are the only statement of what is actually live. (`action:
   * 'list'` also caps at 500 rows, so a blanket scan could not see them all anyway.)
   *
   * The pages are DISCOVERED, not configured: the schedule feeds the home rail, the show
   * page, station info, events, the playlist — eight pages at last count — and a hand-kept
   * list of them goes stale the moment someone adds a ninth. One `list` call gets all the
   * pages with their section arrays; the sections themselves need a by-id load each
   * (~155), which is why this reports progress.
   */
  const readTargets = React.useCallback(async (onProgress) => {
    if (!apiLoad || !format?.app) return null
    const only = targetPageIdList.split(",").map((x) => x.trim()).filter(Boolean)
    const res = await apiLoad({
      format: { app: format.app, type: `${targetPattern}|page`, attributes: [] },
      children: [{ type: () => {}, action: "list", path: "/" }],
    })
    const pages = (Array.isArray(res) ? res : [res]).filter(Boolean)
      .filter((p) => !only.length || only.includes(String(p.id)))

    const refs = []
    for (const pg of pages) {
      const seen = new Set()
      for (const [list, arr] of [["published", pg.sections], ["draft", pg.draft_sections]]) {
        for (const r of arr || []) {
          if (!r?.id || seen.has(String(r.id))) continue
          seen.add(String(r.id))
          refs.push({ id: String(r.id), list, page: pg.url_slug || pg.id })
        }
      }
    }

    const out = []
    let done = 0
    for (const ref of refs) {
      const row = await loadById(`${targetPattern}|component`, ref.id)
      done++
      if (onProgress) onProgress(done, refs.length)
      const raw = row?.element?.["element-data"]
      if (typeof raw !== "string") continue
      let ed
      try { ed = JSON.parse(raw) } catch { continue }
      if (ed?.externalSource?.source_id !== state.externalSource?.source_id) continue
      out.push({ ...ref, row, ed, view_id: ed.externalSource.view_id })
    }
    return out
  }, [apiLoad, loadById, format?.app, targetPattern, targetPageIdList, state.externalSource?.source_id])

  // What the public site is showing RIGHT NOW, read from the sections themselves rather
  // than from a hand-authored `liveVersion` string that nothing keeps true.
  React.useEffect(() => {
    let alive = true
    readTargets()
      .then((t) => {
        if (!alive) return
        if (!t?.length) { setLiveInfo("none"); return }
        const ids = [...new Set(t.map((x) => x.view_id))]
        setLiveInfo({ view_id: ids.length === 1 ? ids[0] : null, mixed: ids.length > 1, sections: t })
      })
      .catch((e) => { if (alive) { console.error("[ScheduleGrid] could not read live targets:", e.message); setLiveInfo("none") } })
    return () => { alive = false }
  }, [readTargets, publishedNote])

  const doPublish = async () => {
    if (!apiUpdate || publishing || !viewId) return
    setPublishing(true); setPublishError(null); setProgress(null)
    try {
      const targets = await readTargets((d, n) => setProgress(`reading ${d}/${n}`))
      if (!targets?.length) throw new Error("Found no public section bound to this schedule source")
      const label = versionLabel(versions.find((v) => v.view_id === Number(viewId))) || `Version ${viewId}`
      const stale = targets.filter((t) => Number(t.view_id) !== Number(viewId))
      let n = 0
      for (const t of stale) {
        const ed = { ...t.ed, externalSource: { ...t.ed.externalSource, view_id: Number(viewId), view_name: label } }
        // `element-data` is a JSON STRING; the rest of the row must be written back
        // untouched or the section loses its group, size, padding and title.
        const data = { ...t.row, id: t.id, element: { ...t.row.element, "element-data": JSON.stringify(ed) } }
        await apiUpdate({ data, config: { format: { app: format.app, type: `${targetPattern}|component` } } })
        n++
        setProgress(`writing ${n}/${stale.length}`)
      }
      // Repoint anything that TAGS with this schedule. Reported separately and never
      // fatal: the sections are already live at this point, and failing the whole publish
      // over the tag pointer would leave the site correct but the operator believing
      // otherwise. A source the user cannot write (they differ per source) surfaces here.
      let taggedNote = ""
      if (taggingSourceIds.length && falcor) {
        const okIds = [], failed = []
        for (const sid of taggingSourceIds) {
          setProgress(`tagging source ${sid}`)
          try {
            await udaUpdateSourceMetadata(falcor, {
              env: srcEnv,
              source_id: sid,
              mutate: (m) => ({
                ...m,
                schedule: { ...(m.schedule || {}), source_id: state.externalSource?.source_id, view_id: Number(viewId) },
              }),
            })
            okIds.push(sid)
          } catch (e) {
            failed.push(`${sid} (${e?.message || "failed"})`)
          }
        }
        if (okIds.length) taggedNote = ` New playlist detections now tag against it.`
        if (failed.length) taggedNote += ` Could NOT update tagging on source ${failed.join(", ")}.`
      }

      // Report by page — "8 sections" is meaningless, "schedule, home, show" is not.
      const pages = [...new Set(stale.map((t) => t.page))]
      setPublishedNote((n === 0
        ? `Every public section already reads ${label}.`
        : `${label} is live \u2014 ${n} section${n === 1 ? "" : "s"} on ${pages.length} page${pages.length === 1 ? "" : "s"}: ${pages.join(", ")}`) + taggedNote)
      setPublishOpen(false)
    } catch (e) {
      setPublishError(e?.message || "Could not publish")
    } finally {
      setPublishing(false); setProgress(null)
    }
  }

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
  /* What the public site is actually serving. `display.liveVersion` used to be a
   * hand-typed string ("Version 1 · v10") that nothing kept in sync; the discovered
   * view_id is the truth, and the authored string is only a fallback for when no
   * target page is configured. */
  const liveOutgoing = React.useMemo(() => {
    if (liveInfo && liveInfo !== "none") {
      if (liveInfo.mixed) {
        const ids = [...new Set(liveInfo.sections.map((x) => x.view_id))]
        return { name: `mixed \u2014 ${ids.map((i) => `v${i}`).join(", ")}`, rowCount: `${liveInfo.sections.length} sections` }
      }
      const v = versions.find((x) => x.view_id === Number(liveInfo.view_id))
      return { name: versionLabel(v) || `Version ${liveInfo.view_id}`,
               rowCount: `${liveInfo.sections.length} section${liveInfo.sections.length === 1 ? "" : "s"}` }
    }
    return display.liveVersion ? { name: display.liveVersion, rowCount: display.liveRowCount ?? "?" } : null
  }, [liveInfo, versions, versionLabel, display.liveVersion, display.liveRowCount])
  const live = liveOutgoing?.name || null

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
        {publishedNote ? <span className={t.publishedNote}>{publishedNote}</span> : null}
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
        outgoing={liveOutgoing}
        rowCount={blocks.length}
        onConfirm={doPublish}
        busy={publishing}
        canPublish={liveInfo !== null && liveInfo !== "none"}
        progress={progress}
        blockedReason={
          publishError ? publishError
            : liveInfo === null
              ? "Reading the public pages\u2026"
              : liveInfo === "none"
                ? `No section on any ${targetPattern} page is bound to this schedule source, so there is nothing to repoint.`
                : null
        }
      />
    </div>
  )
}

export const ScheduleGridEdit = ScheduleGridView

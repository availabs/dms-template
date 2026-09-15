import { useEffect, useMemo, useState } from 'react';
import { saveAsReportModalTheme } from './SaveAsReportModal.theme';
import { tagsForCopy, nextCopyTitle } from './useSaveAsReport';
import { tagToLabel, isUserTag } from '../RouteTagBrowserModal/tagCategories';

// The "Save as…" dialog (report-save-as-copy.md). Presentation only — every decision about what a
// copy actually contains lives in useSaveAsReport.js; this collects a name and a target kind and
// hands them over.
//
// Deliberately a plain backdrop + panel rather than the shared PickerModal chrome: that chrome is
// built for browse/search surfaces (facets, result counts, sort), and this is a three-field form.
// Same structural pattern core's own PageTemplatePicker uses.
export default function SaveAsReportModal({
  open, onClose, onConfirm, sourceTitle, siblings, isDynamicReport,
  sourceTags, user, saving, error, loadingSource, canConvertToStatic,
}) {
  const t = saveAsReportModalTheme;
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState(isDynamicReport ? 'dynamic' : 'static');

  // Re-seed every time the dialog opens, not once on mount — reopening it after a rename (or after
  // navigating to a different report) must not show the previous report's suggested name.
  useEffect(() => {
    if (!open) return;
    setTitle(nextCopyTitle(sourceTitle, siblings));
    setKind(isDynamicReport ? 'dynamic' : 'static');
  }, [open, sourceTitle, siblings, isDynamicReport]);

  // Which of the source's tags survive onto the copy, and which don't. Shown rather than applied
  // silently: an author who can't hold one of the source's agency tags should be able to see that
  // before saving, not discover it afterwards on a report that's filed somewhere unexpected.
  const { carried, dropped } = useMemo(() => {
    const next = tagsForCopy(sourceTags, user);
    const nextSet = new Set(next);
    return {
      carried: next,
      dropped: (sourceTags || []).filter((tag) => !nextSet.has(tag) && !isUserTag(tag)),
    };
  }, [sourceTags, user]);

  if (!open) return null;

  // Wording follows the SOURCE's kind: from a static report the interesting choice is "make this
  // reusable", from a dynamic one it's "freeze these routes in".
  const kinds = isDynamicReport
    ? [
        { value: 'dynamic', name: 'Dynamic report', desc: 'Keeps the route slots. Whoever opens the copy picks their own routes.', badge: 'same as this report' },
        { value: 'static', name: 'Static report', desc: 'Freezes the routes showing right now into the copy.', disabled: !canConvertToStatic, disabledNote: 'Pick routes on this report first.' },
      ]
    : [
        { value: 'static', name: 'Static report', desc: 'Keeps this report’s exact routes.', badge: 'same as this report' },
        { value: 'dynamic', name: 'Dynamic report', desc: 'Turns the routes into slots, so whoever opens the copy picks their own.' },
      ];

  const disabled = saving || loadingSource || !title.trim();

  return (
    <div className={t.backdrop} onClick={(e) => e.target === e.currentTarget && !saving && onClose()}>
      <div className={t.modal}>
        <div className={t.header}>
          <div className={t.headerTitle}>Save a copy</div>
          <div className={t.headerSub}>
            Creates a new report alongside this one. The report you&rsquo;re looking at isn&rsquo;t changed.
          </div>
        </div>

        <div className={t.body}>
          <div>
            <label className={t.fieldLabel} htmlFor="save-as-report-title">Name</label>
            <input
              id="save-as-report-title"
              className={t.textInput}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !disabled) onConfirm({ title, kind }); }}
              autoFocus
            />
          </div>

          <div>
            <span className={t.fieldLabel}>Report type</span>
            <div className={t.kindList}>
              {kinds.map((k) => {
                const selected = kind === k.value;
                const cls = k.disabled ? t.kindOptionDisabled : selected ? t.kindOptionSelected : t.kindOption;
                return (
                  <button
                    key={k.value}
                    type="button"
                    className={cls}
                    disabled={k.disabled}
                    title={k.disabled ? k.disabledNote : undefined}
                    onClick={() => !k.disabled && setKind(k.value)}
                  >
                    <div className={t.kindName}>
                      {k.name}
                      {k.badge ? <span className={t.kindBadge}>{k.badge}</span> : null}
                    </div>
                    <div className={t.kindDesc}>{k.disabled ? k.disabledNote : k.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <span className={t.fieldLabel}>Tags on the copy</span>
            {loadingSource ? (
              <div className={t.tagNote}>Loading this report&rsquo;s tags…</div>
            ) : (
              <>
                <div className={t.tagPreview}>
                  {carried.length === 0 && dropped.length === 0 ? (
                    <span className={t.tagNote}>No tags.</span>
                  ) : null}
                  {carried.map((tag) => (
                    <span key={tag} className={isUserTag(tag) ? t.tagChipNew : t.tagChip}>
                      {isUserTag(tag) ? 'You' : tagToLabel(tag, user?.id)}
                    </span>
                  ))}
                  {dropped.map((tag) => (
                    <span key={tag} className={t.tagChipDropped} title="You aren't in this group, so the copy can't carry this tag">
                      {tagToLabel(tag, user?.id)}
                    </span>
                  ))}
                </div>
                {dropped.length > 0 ? (
                  <div className={t.tagNote}>
                    Crossed-out tags stay off the copy — they belong to groups you aren&rsquo;t a member of.
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>

        <div className={t.footer}>
          {error ? <span className={t.error}>{error}</span> : null}
          {!error && saving ? <span className={t.hint}>Copying sections…</span> : null}
          <button type="button" className={t.cancelBtn} onClick={onClose} disabled={saving}>Cancel</button>
          <button
            type="button"
            className={t.saveBtn}
            disabled={disabled}
            onClick={() => onConfirm({ title, kind })}
          >
            {saving ? 'Saving…' : 'Save copy'}
          </button>
        </div>
      </div>
    </div>
  );
}

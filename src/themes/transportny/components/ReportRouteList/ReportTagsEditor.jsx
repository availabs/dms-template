import { useState } from 'react';
import { tagToLabel, canonicalizeTag } from '../RouteTagBrowserModal/tagCategories';

// Report-level tag editor, placed in ReportRouteList's "Report settings" panel — same
// type-and-commit chip input as routes' own tag editor (SaveRouteModal.jsx's TagsInputField),
// deliberately not constrained to the fixed agency vocabulary at entry time (mirrors that
// component's own choice: browsing is fixed-vocabulary, entry is free-form). Round 82
// (old-reports-conversion.md, "Round B"). Round 83 (2026-08-31) added canonicalizeTag() on
// commit — typing a known vocabulary code/label (e.g. "AVAIL") now resolves to the same
// canonical value ("agency:AVAIL") the Tag Browser filters on, instead of silently committing an
// orphan tag the browse tree can never find (see tagCategories.js's canonicalizeTag doc).
export default function ReportTagsEditor({ tags, onChange, theme: t, Icon }) {
  const [draft, setDraft] = useState('');
  const list = tags || [];

  const commitDraft = () => {
    const tag = canonicalizeTag(draft);
    setDraft('');
    if (tag && !list.includes(tag)) onChange([...list, tag]);
  };

  const removeTag = (tag) => onChange(list.filter((existing) => existing !== tag));

  return (
    <div className={t.tagsEditorWrapper}>
      <div className={t.tagsEditorLabel}>Tags</div>
      <div className={t.tagsEditorChips}>
        {list.map((tag) => (
          <span key={tag} className={t.tagsEditorChip}>
            {tagToLabel(tag)}
            <button type="button" onClick={() => removeTag(tag)}>
              <Icon icon="XMark" className={t.tagsEditorChipRemove} />
            </button>
          </span>
        ))}
        <input
          type="text"
          className={t.tagsEditorInput}
          placeholder="Add a tag…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              commitDraft();
            } else if (e.key === 'Backspace' && !draft && list.length) {
              removeTag(list[list.length - 1]);
            }
          }}
          onBlur={commitDraft}
        />
      </div>
    </div>
  );
}

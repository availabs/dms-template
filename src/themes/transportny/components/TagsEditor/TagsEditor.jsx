import { useState } from 'react';
import {
  tagToLabel,
  canonicalizeTag,
  defaultTagsForUser,
  isTagAllowedForUser,
  isUserTag,
} from '../RouteTagBrowserModal/tagCategories';
import { tagsEditorTheme } from './TagsEditor.theme';

// Shared tag chip-input, used by BOTH routes (SaveRouteModal.jsx) and reports
// (ReportRouteList.jsx's "Report settings" panel, ReportPageHeader.jsx's inline editor) —
// replaces two previously-separate, already-diverged implementations (ReportTagsEditor.jsx had
// canonicalizeTag validation; SaveRouteModal's inline TagsInputField had none at all, a real gap
// this closes). routes-reports-users-mesh.md, Workstream D, 2026-09-01.
//
// `user` is the CMSContext user object ({id, groups}) — optional; when present, not-yet-added
// default tags (the viewer's own user: tag + their real login-group agency: tags) render as
// one-click "+ label" suggestion chips, and free-text commits of an agency: tag the viewer isn't
// actually a member of are rejected with an inline message instead of silently succeeding
// ("should not be allowed to add agency tags if they are not a part of that agency... should not
// even see those as an option" — the suggestion-chip list already only ever shows the viewer's
// OWN groups; this rejection closes the separate free-text-typing path to the same restriction).
export default function TagsEditor({ tags, onChange, user, theme, Icon, inline = false }) {
  const t = { ...tagsEditorTheme, ...theme };
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const list = tags || [];

  const commitDraft = () => {
    const tag = canonicalizeTag(draft);
    if (!tag) {
      setDraft('');
      return;
    }
    if (!isTagAllowedForUser(tag, user)) {
      setError(`You're not in ${tagToLabel(tag, user?.id)} — ask an admin to add you to that group first.`);
      return;
    }
    setError('');
    setDraft('');
    if (!list.includes(tag)) onChange([...list, tag]);
  };

  const removeTag = (tag) => onChange(list.filter((existing) => existing !== tag));

  const addSuggestion = (tag) => {
    setError('');
    if (!list.includes(tag)) onChange([...list, tag]);
  };

  const suggestions = defaultTagsForUser(user).filter((tag) => !list.includes(tag));

  return (
    <div className={inline ? t.tagsEditorWrapperInline : t.tagsEditorWrapper}>
      {!inline ? <div className={t.tagsEditorLabel}>Tags</div> : null}
      <div className={t.tagsEditorChips}>
        {inline ? <span className={t.tagsEditorLabel}>Tags</span> : null}
        {list.map((tag) => {
          // A `user:` tag reads as "who owns this," not a category, so it gets its own quieter
          // chip (a small dot + "You") instead of the same institutional chip every agency:/
          // county:/free-text tag shares — the ask this closes is "tell user apart from agency at
          // a glance," not just tagToLabel's text simplification (routes-reports-users-mesh.md).
          const userTag = isUserTag(tag);
          const chipClass = userTag ? t.tagsEditorChipUser : t.tagsEditorChip;
          const removeClass = userTag ? t.tagsEditorChipRemoveUser : t.tagsEditorChipRemove;
          return (
            <span key={tag} className={chipClass}>
              {userTag ? <span className={t.tagsEditorChipUserDot} /> : null}
              {tagToLabel(tag, user?.id)}
              <button type="button" onClick={() => removeTag(tag)}>
                {Icon ? <Icon icon="XMark" className={removeClass} /> : <span className={removeClass}>&times;</span>}
              </button>
            </span>
          );
        })}
        {suggestions.map((tag) => (
          <button key={tag} type="button" className={t.tagsEditorSuggestionChip} onClick={() => addSuggestion(tag)}>
            + {tagToLabel(tag, user?.id)}
          </button>
        ))}
        <input
          type="text"
          className={t.tagsEditorInput}
          placeholder="Add a tag…"
          value={draft}
          onChange={(e) => {
            setError('');
            setDraft(e.target.value);
          }}
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
      {error ? <div className={t.tagsEditorError}>{error}</div> : null}
    </div>
  );
}

import React from "react";
import { ThemeContext, getComponentTheme } from "../../../../../dms/packages/dms/src/ui/useTheme";
import useModalOverlay from "../../../../../dms/packages/dms/src/ui/components/useModalOverlay";
import { routecreationTheme } from "../routecreation.theme";
import TagsEditor from "../../TagsEditor/TagsEditor";

// Save/update dialog — npmrds-route-creation.html § 02 ("the modal, drawn"). Replaces the old
// inline-`style` div (raw `style={modalStyle}`, no backdrop, no close-on-escape/click-outside,
// an `<input type="textarea">` for Description that only ever behaved as one line) with the SAME
// backdrop+wrapper mechanism macroview's DownloadBuilder (downloadBuilder.jsx) already uses for
// a floating map-plugin modal, styled to the mockup's own skin (white header, the Panel 1 Road
// icon, brand blue `#1F3F8F` submit) rather than macroview's dark-header/yellow-accent one. Same
// three fields the old modal had — name/description/tags — findings.md Part 4 covers why folder
// + start/end date stay out; this pass is styling + chrome, not new fields.
export const SaveRouteModal = ({
  open,
  modalState,
  setModalOpen,
  setRouteMeta,
  addItem,
  isEditingRoute,
  user,
}) => {
  const { theme: themeFromContext = {} } = React.useContext(ThemeContext) || {};
  const t = { ...routecreationTheme, ...getComponentTheme(themeFromContext, "routecreation") };
  const close = () => setModalOpen(false);
  useModalOverlay(open, close);

  if (!open) return null;

  return (
    <>
      <div className={t.saveModalBackdrop} onClick={close} />
      <div className={t.saveModalWrapper}>
        <div className={t.saveModalCard}>
          <div className={t.saveModalBody}>
            <div className={t.saveModalHead}>
              <span className={t.saveModalIconWrap}>
                <svg className={t.saveModalIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M4 20 8 4m12 16L16 4M12 5v2m0 4v2m0 4v2" />
                </svg>
              </span>
              <div className="min-w-0">
                <div className={t.saveModalTitle}>{isEditingRoute ? "Update route" : "Save new route"}</div>
                {isEditingRoute && (
                  <p className={t.saveModalWarning}>
                    You are updating an existing route. Saving overwrites it — it does not create a new one.
                  </p>
                )}
              </div>
            </div>

            <div className={t.saveModalFields}>
              <div>
                <div className={t.saveModalFieldLabel}>Name</div>
                <input
                  type="text"
                  className={t.saveModalNameInput}
                  value={modalState.name}
                  onChange={(e) => setRouteMeta({ name: e.target.value })}
                />
              </div>
              <div>
                <div className={t.saveModalFieldLabel}>Description</div>
                <textarea
                  className={t.saveModalDescInput}
                  rows={3}
                  value={modalState.description}
                  onChange={(e) => setRouteMeta({ description: e.target.value })}
                />
              </div>
              <div>
                {/* No separate field-label div here - TagsEditor renders its own "Tags" label
                    (non-inline mode); overriding it to saveModalFieldLabel's style keeps it
                    looking like Name/Description's labels instead of stacking two "Tags" headers. */}
                <TagsEditor
                  tags={modalState.tags}
                  onChange={(tags) => setRouteMeta({ tags })}
                  user={user}
                  theme={{ ...t, tagsEditorWrapper: "", tagsEditorLabel: t.saveModalFieldLabel }}
                />
              </div>
            </div>

            <div className={t.saveModalFoot}>
              <button type="button" className={t.saveModalCancelBtn} onClick={close}>
                Cancel
              </button>
              <button type="button" className={t.saveModalSubmitBtn} onClick={addItem}>
                {isEditingRoute ? "Update" : "Save"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

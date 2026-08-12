import React, { useState } from "react";

export const SaveRouteModal = ({
  modalState,
  modalStyle,
  setModalOpen,
  setRouteMeta,
  addItem,
  isEditingRoute,
}) => {
  return (
    <div
      style={modalStyle}
      className="bg-white/[95%] pointer-events-auto"
    >
      <div className="flex flex-col h-[100%]">
        <div className="flex items-center m-1">
          <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10">
            <i className="fad fa-layer-group text-blue-600" aria-hidden="true" />
          </div>
          <div className="mt-3 text-center sm:ml-2 sm:mt-0 sm:text-left w-full">
            <div className="text-lg align-center font-semibold leading-6 text-gray-900">
              {isEditingRoute ? "Update Route" : "Save New Route"}
            </div>
            {isEditingRoute && (
              <div className="text-sm text-red-600">
                You are updating an existing route. Saving will overwrite it, not create a new one.
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-4">
          <ModalInputField
            label="Name"
            value={modalState.name}
            path={"name"}
            onChange={setRouteMeta}
            type="text"
          />
        </div>
        <div className="flex gap-4">
          <ModalInputField
            label="Description"
            value={modalState.description}
            path={"description"}
            onChange={setRouteMeta}
            type="textarea"
          />
        </div>
        <div className="flex gap-4 border-b-2 py-4 mb-4">
          <TagsInputField
            label="Tags"
            value={modalState.tags}
            path={"tags"}
            onChange={setRouteMeta}
          />
        </div>
        <div className="absolute" style={{ bottom: "20px", right: "20px" }}>
          <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
            <button
              onClick={addItem}
              className="disabled:bg-slate-300 disabled:cursor-warning inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 sm:ml-3 sm:w-auto cursor-pointer"
            >
              {isEditingRoute ? "Update" : "Save"}
            </button>
            <button
              type="button"
              className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto cursor-pointer"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Free-form chip input - no fixed tag vocabulary exists yet (old-tool folder taxonomy
// inspection is a separate, not-yet-done task), so entry is type-and-commit rather than
// select-from-list.
const TagsInputField = ({ label, path, value, onChange }) => {
  const tags = value || [];
  const [draft, setDraft] = useState("");

  const commitDraft = () => {
    const tag = draft.trim();
    setDraft("");
    if (tag && !tags.includes(tag)) {
      onChange({ [path]: [...tags, tag] });
    }
  };

  const removeTag = (tag) => {
    onChange({ [path]: tags.filter((t) => t !== tag) });
  };

  return (
    <div className="w-full">
      <div className="font-bold">{label}</div>
      <div className="flex flex-wrap items-center gap-2 w-full p-2 bg-white rounded">
        {tags.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-sm text-blue-800"
          >
            {tag}
            <i
              className="fad fa-times cursor-pointer"
              aria-hidden="true"
              onClick={() => removeTag(tag)}
            />
          </span>
        ))}
        <input
          type="text"
          className="flex-1 min-w-[8rem] p-1 outline-none"
          placeholder="Add a tag..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              commitDraft();
            } else if (e.key === "Backspace" && !draft && tags.length) {
              removeTag(tags[tags.length - 1]);
            }
          }}
          onBlur={commitDraft}
        />
      </div>
    </div>
  );
};

const ModalInputField = ({ label, path, value, onChange, type = "text" }) => (
  <div>
    <div className="font-bold">{label}</div>
    <label className="flex w-full">
      <div className="flex w-full items-center">
        <input
          type={type}
          className="w-full p-2 bg-white rounded"
          value={value}
          onChange={(e) => {
            onChange({ [path]: e.target.value });
          }}
        />
      </div>
    </label>
  </div>
);

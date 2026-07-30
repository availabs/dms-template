import React from "react";

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
        <div className="flex gap-4 border-b-2 py-4 mb-4">
          <ModalInputField
            label="Description"
            value={modalState.description}
            path={"description"}
            onChange={setRouteMeta}
            type="textarea"
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

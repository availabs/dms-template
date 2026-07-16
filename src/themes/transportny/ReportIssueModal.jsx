import React from "react";
import { useLocation } from "react-router";
import { ThemeContext } from "~/dms/packages/dms/src/ui/useTheme";
import { CMSContext } from "~/dms/packages/dms/src";
import { PageContext } from "~/dms/packages/dms/src/patterns/page/context";
import { TICKETS_SOURCE, SEVERITIES, DEFAULT_SEVERITY, buildTicketRow } from "./ticketRow";

// A focused modal: report an issue → create a sitemgmt_tickets row via the standard
// DMS write path (apiUpdate → dms.data.create), the same path the Control Room's
// add-new Card form uses. Phase 1: title / severity / description only.
export default function ReportIssueModal({ open, setOpen }) {
  const { UI } = React.useContext(ThemeContext) || {};
  const pageCtx = React.useContext(PageContext) || {};
  const cmsCtx = React.useContext(CMSContext) || {};
  const apiUpdate = pageCtx.apiUpdate || cmsCtx.apiUpdate;
  const { pathname } = useLocation();
  const pageItem = pageCtx.item || {};
  const user = cmsCtx.user || {};

  const { Modal, Input, Textarea, Select } = UI || {};

  const [title, setTitle] = React.useState("");
  const [severity, setSeverity] = React.useState(DEFAULT_SEVERITY);
  const [description, setDescription] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [done, setDone] = React.useState(false);

  const reset = () => {
    setTitle("");
    setSeverity(DEFAULT_SEVERITY);
    setDescription("");
    setError("");
    setDone(false);
    setBusy(false);
  };
  const close = () => { setOpen(false); reset(); };

  const canSubmit = title.trim() && description.trim() && !busy && !!apiUpdate;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError("");
    try {
      // Full "YYYY-MM-DD HH:MM:SS" timestamp (not date-only): the tickets list sorts `updated`
      // desc as strings, and a datetime sorts above the many same-day date-only rows, so a
      // just-reported ticket lands at the top of the list instead of buried on page 2.
      const asOf = new Date().toISOString().slice(0, 19).replace("T", " ");
      const pageName = pageItem.title || (typeof document !== "undefined" ? document.title : "");
      const host = typeof window !== "undefined" ? window.location.host : "";
      const row = buildTicketRow({ title, severity, description, asOf, pathname, pageName, host, reporterEmail: user.email });
      const res = await apiUpdate({ data: row, config: { format: { ...TICKETS_SOURCE } } });
      if (res && res.error) throw new Error(res.error);
      setDone(true);
    } catch (e) {
      setError(e?.message || "Could not submit the ticket. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!Modal) return null;

  const labelCls = "block text-sm font-semibold text-slate-700 mb-1";

  return (
    <Modal open={open} setOpen={setOpen}>
      <div className="text-left">
        <h2 className="font-['Oswald'] text-lg font-semibold text-slate-900 mb-1">Report an issue</h2>
        <p className="text-sm text-slate-500 mb-4">Open a ticket for the site management team.</p>

        {done ? (
          <div className="py-6 text-center">
            <p className="text-slate-700 font-medium mb-4">Thanks — your ticket was submitted.</p>
            <button
              type="button"
              onClick={close}
              className="inline-flex justify-center rounded-md bg-[#1F3F8F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#16307A]"
            >
              Close
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Title</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short summary of the issue" />
            </div>
            <div>
              <label className={labelCls}>Severity</label>
              <Select value={severity} onChange={setSeverity} options={SEVERITIES.map((s) => ({ label: s, value: s }))} />
            </div>
            <div>
              <label className={labelCls}>Description</label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What happened, and what did you expect?" />
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <div className="flex flex-row-reverse gap-2 pt-2">
              <button
                type="button"
                disabled={!canSubmit}
                onClick={submit}
                className="inline-flex justify-center rounded-md bg-[#1F3F8F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#16307A] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy ? "Submitting…" : "Submit ticket"}
              </button>
              <button
                type="button"
                onClick={close}
                className="inline-flex justify-center rounded-md bg-white px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

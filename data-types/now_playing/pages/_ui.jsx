/**
 * Shared form primitives used by `create.jsx` and `webhook.jsx`.
 *
 * This file is a Vite Fast Refresh boundary — it only exports React
 * components. Hooks, helpers, and constants live in `_helpers.js` so
 * editing one set doesn't kick the other out of HMR. See
 * `src/dms/packages/dms/CLAUDE.md` for the full Fast Refresh rules.
 */

import React from 'react';

export function Field({ label, hint, children }) {
  return (
    <div className="flex flex-col gap-1 mb-3">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {children}
      {hint ? <div className="text-xs text-gray-500">{hint}</div> : null}
    </div>
  );
}

export function CopyField({ value }) {
  const [copied, setCopied] = React.useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.error('clipboard copy failed:', e);
    }
  };
  return (
    <div className="flex gap-2">
      <input
        readOnly
        value={value || ''}
        className="flex-1 p-2 border rounded-md bg-gray-50 font-mono text-xs"
        onFocus={(e) => e.target.select()}
      />
      <button
        type="button"
        onClick={onCopy}
        className="px-3 py-1 text-sm border rounded-md bg-white hover:bg-gray-100"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

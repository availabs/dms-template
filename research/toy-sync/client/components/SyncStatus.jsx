import React, { useState, useEffect } from 'react';
import { onStatusChange, getPendingCount } from '../sync-manager.js';
import { onInvalidate } from '../sync-manager.js';

const STATUS_LABELS = {
  connected: 'Synced',
  syncing: 'Syncing...',
  disconnected: 'Offline',
};

const STATUS_COLORS = {
  connected: 'bg-green-500',
  syncing: 'bg-yellow-500',
  disconnected: 'bg-red-500',
};

export default function SyncStatus() {
  const [status, setStatus] = useState('disconnected');
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const unsub = onStatusChange(setStatus);
    return unsub;
  }, []);

  useEffect(() => {
    async function updatePending() {
      const count = await getPendingCount();
      setPendingCount(count);
    }
    updatePending();
    const unsub = onInvalidate(() => updatePending());
    return unsub;
  }, []);

  return (
    <div className="flex items-center gap-1.5 text-sm text-neutral-500">
      <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[status]}`} />
      <span>{STATUS_LABELS[status] || status}</span>
      {pendingCount > 0 && (
        <span className="text-neutral-600">({pendingCount} pending)</span>
      )}
    </div>
  );
}

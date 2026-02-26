import React, { useState, useEffect, useCallback } from 'react';
import { initDB } from './db-client.js';
import { bootstrap, connectWS } from './sync-manager.js';
import { useMutation } from './use-mutation.js';
import NoteList from './components/NoteList.jsx';
import NoteEditor from './components/NoteEditor.jsx';
import SyncStatus from './components/SyncStatus.jsx';

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const { createNote } = useMutation();

  useEffect(() => {
    async function init() {
      try {
        await initDB();
        console.log('[App] DB Ready');
        await bootstrap();
        console.log('[App] Bootstrap complete');
        connectWS();
        setReady(true);
      } catch (err) {
        console.error('[App] Init failed:', err);
        setError(err.message);
      }
    }
    init();
  }, []);

  const handleCreate = useCallback(async () => {
    const id = crypto.randomUUID();
    await createNote(id, { title: '', description: '' });
    setSelectedId(id);
  }, [createNote]);

  const handleDelete = useCallback(() => {
    setSelectedId(null);
  }, []);

  if (error) {
    return <div className="flex items-center justify-center h-screen text-red-500 text-base">{error}</div>;
  }

  if (!ready) {
    return <div className="flex items-center justify-center h-screen text-neutral-400 text-base">Initializing local database...</div>;
  }

  return (
    <div className="flex flex-col h-screen bg-[#0f0f0f] text-neutral-300">
      <header className="flex items-center justify-between px-5 py-3 border-b border-neutral-800 bg-[#161616]">
        <h1 className="text-lg font-semibold text-white">Toy Sync</h1>
        <SyncStatus />
      </header>
      <div className="flex flex-1 overflow-hidden">
        <NoteList
          selectedId={selectedId}
          onSelect={setSelectedId}
          onCreate={handleCreate}
        />
        <NoteEditor noteId={selectedId} onDelete={handleDelete} />
      </div>
    </div>
  );
}

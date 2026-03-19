import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '../use-query.js';
import { useMutation } from '../use-mutation.js';
import CollabEditor from './CollabEditor.jsx';

export default function NoteEditor({ noteId, onDelete }) {
  const { updateNote, deleteNote } = useMutation();
  const { data: notes } = useQuery(
    'SELECT id, data FROM items WHERE id = ?',
    [noteId],
    [noteId]
  );

  const [title, setTitle] = useState('');
  const debounceRef = useRef(null);
  const localEditRef = useRef(false);
  const titleRef = useRef('');
  const noteIdRef = useRef(noteId);
  noteIdRef.current = noteId;

  // Track which noteId we have loaded data for
  const [loadedNoteId, setLoadedNoteId] = useState(null);

  // Load title from query result (description is managed by CollabEditor/Yjs)
  useEffect(() => {
    if (notes.length > 0 && notes[0].id === noteId && !localEditRef.current) {
      try {
        const parsed = JSON.parse(notes[0].data);
        const t = parsed.title || '';
        setTitle(t);
        titleRef.current = t;
        setLoadedNoteId(noteId);
      } catch {}
    }
    localEditRef.current = false;
  }, [notes, noteId]);

  // Reset when noteId changes
  useEffect(() => {
    localEditRef.current = false;
    setLoadedNoteId(null);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, [noteId]);

  // Save title (field-level LWW, same as before)
  const saveTitle = useCallback((value) => {
    localEditRef.current = true;
    setTitle(value);
    titleRef.current = value;

    const id = noteIdRef.current;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateNote(id, { title: titleRef.current });
    }, 300);
  }, [updateNote]);

  function handleDelete() {
    if (confirm('Delete this note?')) {
      deleteNote(noteId);
      onDelete();
    }
  }

  if (!noteId) {
    return (
      <div className="flex-1 flex items-center justify-center text-neutral-600 text-base">
        <p>Select a note or create a new one</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-5 overflow-hidden">
      <input
        className="bg-transparent border-none text-2xl font-semibold text-white outline-none pb-3 border-b border-neutral-800 mb-4 placeholder:text-neutral-700"
        type="text"
        placeholder="Note title..."
        value={title}
        onChange={(e) => saveTitle(e.target.value)}
      />
      <div className="flex-1 overflow-y-auto">
        {loadedNoteId === noteId ? (
          <CollabEditor noteId={noteId} />
        ) : (
          <div className="text-neutral-600 text-sm p-2">Loading...</div>
        )}
      </div>
      <div className="pt-4 border-t border-neutral-800 mt-4">
        <button
          className="bg-transparent text-red-500 border border-red-500 px-3.5 py-1.5 rounded text-sm cursor-pointer hover:bg-red-500 hover:text-white transition-colors"
          onClick={handleDelete}
        >Delete Note</button>
      </div>
    </div>
  );
}

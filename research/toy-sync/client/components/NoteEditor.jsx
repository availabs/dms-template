import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '../use-query.js';
import { useMutation } from '../use-mutation.js';

export default function NoteEditor({ noteId, onDelete }) {
  const { updateNote, deleteNote } = useMutation();
  const { data: notes } = useQuery(
    'SELECT data FROM items WHERE id = ?',
    [noteId],
    [noteId]
  );

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const debounceRef = useRef(null);
  const localEditRef = useRef(false);

  // Load data from query result
  useEffect(() => {
    if (notes.length > 0 && !localEditRef.current) {
      try {
        const parsed = JSON.parse(notes[0].data);
        setTitle(parsed.title || '');
        setDescription(parsed.description || '');
      } catch {}
    }
    localEditRef.current = false;
  }, [notes]);

  // Reset when noteId changes
  useEffect(() => {
    localEditRef.current = false;
  }, [noteId]);

  function handleChange(field, value) {
    localEditRef.current = true;
    const newTitle = field === 'title' ? value : title;
    const newDesc = field === 'description' ? value : description;

    if (field === 'title') setTitle(value);
    if (field === 'description') setDescription(value);

    // Debounced save
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateNote(noteId, { title: newTitle, description: newDesc });
    }, 300);
  }

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
    <div className="flex-1 flex flex-col p-5">
      <input
        className="bg-transparent border-none text-2xl font-semibold text-white outline-none pb-3 border-b border-neutral-800 mb-4 placeholder:text-neutral-700"
        type="text"
        placeholder="Note title..."
        value={title}
        onChange={(e) => handleChange('title', e.target.value)}
      />
      <textarea
        className="flex-1 bg-transparent border-none text-base text-neutral-400 leading-relaxed outline-none resize-none font-[inherit] placeholder:text-neutral-700"
        placeholder="Write something..."
        value={description}
        onChange={(e) => handleChange('description', e.target.value)}
      />
      <div className="pt-4 border-t border-neutral-800 mt-4">
        <button
          className="bg-transparent text-red-500 border border-red-500 px-3.5 py-1.5 rounded text-sm cursor-pointer hover:bg-red-500 hover:text-white transition-colors"
          onClick={handleDelete}
        >Delete Note</button>
      </div>
    </div>
  );
}

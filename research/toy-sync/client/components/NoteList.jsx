import React from 'react';
import { useQuery } from '../use-query.js';

export default function NoteList({ selectedId, onSelect, onCreate }) {
  const { data: notes, loading } = useQuery(
    "SELECT id, data, updated_at FROM items ORDER BY updated_at DESC"
  );

  if (loading) return <div className="w-70 min-w-70 border-r border-neutral-800 bg-[#131313] p-5 text-neutral-600">Loading...</div>;

  return (
    <div className="w-70 min-w-70 border-r border-neutral-800 flex flex-col bg-[#131313]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
        <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide">Notes</h2>
        <button
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1 rounded cursor-pointer"
          onClick={onCreate}
        >+ New</button>
      </div>
      {notes.length === 0 && (
        <div className="px-4 py-5 text-sm text-neutral-600">No notes yet. Create one!</div>
      )}
      {notes.map((note) => {
        let parsed = {};
        try { parsed = JSON.parse(note.data); } catch {}
        const title = parsed.title || 'Untitled';
        const desc = parsed.description || '';
        const preview = desc.length > 60 ? desc.slice(0, 60) + '...' : desc;

        return (
          <div
            key={note.id}
            className={`px-4 py-2.5 border-b border-neutral-900 cursor-pointer transition-colors
              ${note.id === selectedId ? 'bg-slate-800 border-l-3 border-l-blue-600' : 'hover:bg-neutral-900'}`}
            onClick={() => onSelect(note.id)}
          >
            <div className="text-sm font-medium text-neutral-300 truncate">{title}</div>
            {preview && <div className="text-xs text-neutral-600 mt-0.5 truncate">{preview}</div>}
          </div>
        );
      })}
    </div>
  );
}

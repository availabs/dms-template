import { useCallback } from 'react';
import { localCreate, localUpdate, localDelete } from './sync-manager.js';

export function useMutation() {
  const createNote = useCallback(async (id, data) => {
    await localCreate(id, data);
  }, []);

  const updateNote = useCallback(async (id, data) => {
    await localUpdate(id, data);
  }, []);

  const deleteNote = useCallback(async (id) => {
    await localDelete(id);
  }, []);

  return { createNote, updateNote, deleteNote };
}

import { useState, useEffect, useCallback, FormEvent } from 'react';
import {
  readNotes,
  writeNotes,
  nextNoteId,
  NOTES_STORAGE_KEY,
  type Note,
} from '../notesStorage';
import { socket } from '../socket';

export function HomePage() {
  const [notes, setNotes] = useState<Note[]>(() => readNotes());
  const [draft, setDraft] = useState('');

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === NOTES_STORAGE_KEY) setNotes(readNotes());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const addNote = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setNotes((prev) => {
      const next = [{ id: nextNoteId(prev), text: trimmed }, ...prev];
      writeNotes(next);
      return next;
    });
    socket.emit('newTask', { text: trimmed, timestamp: Date.now() });
  }, []);

  const deleteNote = useCallback((id: number) => {
    setNotes((prev) => {
      const next = prev.filter((n) => n.id !== id);
      writeNotes(next);
      return next;
    });
  }, []);

  function handleSubmit(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    if (!draft.trim()) return;
    addNote(draft);
    setDraft('');
  }

  return (
    <div className='home-content'>
      <form className='task-form' onSubmit={handleSubmit}>
        <input
          className='task-input'
          type='text'
          id='note-input'
          name='note'
          placeholder='Enter a task'
          required
          autoComplete='off'
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button className='btn' type='submit'>
          Add task
        </button>
      </form>
      <ul className='task-list' id='notes-list'>
        {notes.map((note) => (
          <li key={note.id} className='task-item'>
            <span className='task-item__text'>{note.text}</span>
            <button
              type='button'
              className='btn btn--task-delete'
              aria-label='Delete task'
              onClick={() => deleteNote(note.id)}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

import {
  useState,
  useEffect,
  useCallback,
  FormEvent,
  useRef,
  type ChangeEvent,
} from 'react';
import {
  readNotes,
  writeNotes,
  nextNoteId,
  NOTES_STORAGE_KEY,
  type Note,
} from '../notesStorage';
import { socket } from '../socket';
import { hasActivePushSubscription } from '../pushNotifications';

function timestampToDatetimeLocalValue(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function openDatetimePicker(input: HTMLInputElement | null): void {
  if (!input) return;
  const withPicker = input as HTMLInputElement & { showPicker?: () => void };
  try {
    withPicker.showPicker?.();
  } catch {
    input.click();
  }
}

function TaskRow({
  note,
  onDelete,
  onSaveReminder,
}: {
  note: Note;
  onDelete: () => void;
  onSaveReminder: (datetimeLocal: string) => Promise<boolean>;
}) {
  const pickerRef = useRef<HTMLInputElement>(null);

  function startPickReminder(): void {
    const el = pickerRef.current;
    if (!el) return;
    el.value =
      note.reminder != null ? timestampToDatetimeLocalValue(note.reminder) : '';
    requestAnimationFrame(() => openDatetimePicker(el));
  }

  async function handlePickerChange(
    e: ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const v = e.target.value;
    if (!v) return;
    await onSaveReminder(v);
  }

  return (
    <li className='task-item'>
      <div className='task-item__column'>
        <span className='task-item__text'>{note.text}</span>
        <input
          ref={pickerRef}
          type='datetime-local'
          className='visually-hidden'
          tabIndex={-1}
          aria-hidden
          onChange={(e) => void handlePickerChange(e)}
        />
        <div className='task-item__reminder-line'>
          <button
            type='button'
            className={
              note.reminder != null
                ? 'task-item__reminder'
                : 'task-item__reminder task-item__reminder--empty'
            }
            onClick={startPickReminder}
          >
            {note.reminder != null
              ? `Reminder: ${new Date(note.reminder).toLocaleString()}`
              : 'Add reminder'}
          </button>
          {note.reminder != null ? (
            <button
              type='button'
              className='task-item__reminder-clear'
              onClick={(ev) => {
                ev.stopPropagation();
                void onSaveReminder('');
              }}
            >
              Remove
            </button>
          ) : null}
        </div>
      </div>
      <button
        type='button'
        className='btn btn--task-delete'
        aria-label='Delete task'
        onClick={onDelete}
      >
        Delete
      </button>
    </li>
  );
}

export function HomePage() {
  const [notes, setNotes] = useState<Note[]>(() => readNotes());
  const [draft, setDraft] = useState('');
  const [newTaskReminder, setNewTaskReminder] = useState('');
  const newTaskPickerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === NOTES_STORAGE_KEY) setNotes(readNotes());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const addNote = useCallback(
    (text: string, reminderTimestamp: number | null = null) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const prev = readNotes();
      const id = nextNoteId(prev);
      const newNote: Note = {
        id,
        text: trimmed,
        reminder: reminderTimestamp ?? undefined,
      };
      const next = [newNote, ...prev];
      writeNotes(next);
      setNotes(next);

      socket.emit('newTask', { text: trimmed, timestamp: Date.now() });
      if (reminderTimestamp) {
        socket.emit('newReminder', {
          id,
          text: trimmed,
          reminderTime: reminderTimestamp,
        });
      }
    },
    [],
  );

  const deleteNote = useCallback((id: number) => {
    socket.emit('cancelReminder', { id });
    setNotes((prev) => {
      const next = prev.filter((n) => n.id !== id);
      writeNotes(next);
      return next;
    });
  }, []);

  const applyReminderForNote = useCallback(
    async (id: number, datetimeLocal: string): Promise<boolean> => {
      const trimmed = datetimeLocal.trim();
      const note = readNotes().find((n) => n.id === id);
      if (!note) return false;

      if (!trimmed) {
        setNotes((prev) => {
          const next = prev.map((n) =>
            n.id === id ? { ...n, reminder: undefined } : n,
          );
          writeNotes(next);
          return next;
        });
        socket.emit('cancelReminder', { id });
        return true;
      }

      const ts = new Date(trimmed).getTime();
      if (ts <= Date.now()) {
        window.alert('Reminder time must be in the future');
        return false;
      }

      const pushOk = await hasActivePushSubscription();
      if (!pushOk) {
        window.alert(
          'Push is off: the reminder will not arrive. Enable notifications via the bell in the header, then save again.',
        );
      }

      setNotes((prev) => {
        const next = prev.map((n) =>
          n.id === id ? { ...n, reminder: ts } : n,
        );
        writeNotes(next);
        return next;
      });
      socket.emit('newReminder', {
        id,
        text: note.text,
        reminderTime: ts,
      });
      return true;
    },
    [],
  );

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (!draft.trim()) return;

    let reminderTs: number | null = null;
    if (newTaskReminder.trim()) {
      const ts = new Date(newTaskReminder).getTime();
      if (ts <= Date.now()) {
        window.alert('Reminder time must be in the future');
        return;
      }
      reminderTs = ts;
    }

    if (reminderTs) {
      const pushOk = await hasActivePushSubscription();
      if (!pushOk) {
        window.alert(
          'Push is off: the reminder will not arrive. Enable notifications via the bell in the header, then add the task again.',
        );
      }
    }

    addNote(draft, reminderTs);
    setDraft('');
    setNewTaskReminder('');
  }

  function openNewTaskReminderPicker(): void {
    const el = newTaskPickerRef.current;
    if (!el) return;
    el.value = newTaskReminder;
    requestAnimationFrame(() => openDatetimePicker(el));
  }

  function onNewTaskPickerChange(e: ChangeEvent<HTMLInputElement>): void {
    const v = e.target.value;
    if (v) setNewTaskReminder(v);
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
        <input
          ref={newTaskPickerRef}
          type='datetime-local'
          id='new-task-reminder'
          className='visually-hidden'
          tabIndex={-1}
          aria-hidden
          onChange={onNewTaskPickerChange}
        />
        {newTaskReminder ? (
          <>
            <button
              type='button'
              className='task-form__reminder-pill'
              onClick={openNewTaskReminderPicker}
            >
              Reminder: {new Date(newTaskReminder).toLocaleString()}
            </button>
            <button
              type='button'
              className='task-form__reminder-remove'
              onClick={() => setNewTaskReminder('')}
            >
              Remove
            </button>
          </>
        ) : (
          <button
            type='button'
            className='task-form__reminder-pill task-form__reminder-pill--muted'
            onClick={openNewTaskReminderPicker}
          >
            Add reminder
          </button>
        )}
        <button className='btn' type='submit'>
          Add task
        </button>
      </form>

      <ul className='task-list' id='notes-list'>
        {notes.map((note) => (
          <TaskRow
            key={note.id}
            note={note}
            onDelete={() => deleteNote(note.id)}
            onSaveReminder={(dt) => applyReminderForNote(note.id, dt)}
          />
        ))}
      </ul>
    </div>
  );
}

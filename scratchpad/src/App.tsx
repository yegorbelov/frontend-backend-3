import { useState, useEffect, type FormEvent } from 'react';

const STORAGE_KEY = 'tasks';

function readTasks(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === 'string')
      : [];
  } catch {
    return [];
  }
}

export default function App() {
  const [tasks, setTasks] = useState<string[]>(readTasks);
  const [input, setInput] = useState('');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setTasks((prev) => [...prev, text]);
    setInput('');
  }

  return (
    <div className='app'>
      <h1>Scratchpad</h1>
      <form className='task-form' onSubmit={handleSubmit}>
        <input
          className='task-input'
          type='text'
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder='New task'
          required
          autoComplete='off'
        />
        <button className='btn' type='submit'>
          Add Task
        </button>
      </form>

      <ul className='task-list'>
        {tasks
          .slice()
          .reverse()
          .map((task, i) => (
            <li key={`${i}-${task.slice(0, 24)}`} className='task-item'>
              {task}
            </li>
          ))}
      </ul>
    </div>
  );
}

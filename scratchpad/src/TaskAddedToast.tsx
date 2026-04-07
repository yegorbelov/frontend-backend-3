import { useState, useEffect } from 'react';
import { socket } from './socket';

export function TaskAddedToast() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onTaskAdded = (task: { text?: string }) => {
      if (timer) clearTimeout(timer);
      const text = task.text ?? '';
      setMessage(text);
      console.log('Task from another client:', task);
      timer = setTimeout(() => setMessage(null), 3000);
    };
    socket.on('taskAdded', onTaskAdded);
    return () => {
      socket.off('taskAdded', onTaskAdded);
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (message === null) return null;

  return (
    <div className='task-toast' role='status'>
      New Task: {message}
    </div>
  );
}

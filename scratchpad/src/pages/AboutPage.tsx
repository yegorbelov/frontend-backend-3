export function AboutPage() {
  return (
    <div className='about-content'>
      <h2 className='section-title'>About</h2>
      <p className='section-title muted'>Version 1.2.3</p>
      <p>
        This is a lightweight task app: capture to-dos, see them in one place, and
        delete them when finished. Everything is stored locally in{' '}
        <code>localStorage</code>, so your list stays on this device across
        reloads.
      </p>
      <p>
        With the server running, new tasks are shared in real time via Socket.IO
        (other tabs get an on-screen notice). Use the bell in the header if you
        want optional browser push reminders.
      </p>
    </div>
  );
}

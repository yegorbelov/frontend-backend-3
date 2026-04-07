import { useState } from 'react';
import { HomePage } from './pages/HomePage';
import { AboutPage } from './pages/AboutPage';
import { PushNotificationsButton } from './PushNotificationsButton';
import { TaskAddedToast } from './TaskAddedToast';

type Page = 'home' | 'about';

export default function App() {
  const [page, setPage] = useState<Page>('home');
  const [activeBtn, setActiveBtn] = useState<'home-btn' | 'about-btn'>(
    'home-btn',
  );

  function goHome(): void {
    setActiveBtn('home-btn');
    setPage('home');
  }

  function goAbout(): void {
    setActiveBtn('about-btn');
    setPage('about');
  }

  return (
    <div className='app app-shell'>
      <TaskAddedToast />
      <header className='app-shell__header'>
        <div className='app-shell__header-row'>
          <h1>Scratchpad</h1>
          <PushNotificationsButton />
        </div>
        <nav className='shell-tabs' aria-label='Tabs'>
          <button
            id='home-btn'
            type='button'
            className={`shell-tab${activeBtn === 'home-btn' ? ' shell-tab--active' : ''}`}
            onClick={goHome}
          >
            Home
          </button>
          <button
            id='about-btn'
            type='button'
            className={`shell-tab${activeBtn === 'about-btn' ? ' shell-tab--active' : ''}`}
            onClick={goAbout}
          >
            About
          </button>
        </nav>
      </header>

      <main id='app-content' className='app-shell__main'>
        {page === 'home' ? <HomePage /> : <AboutPage />}
      </main>
    </div>
  );
}

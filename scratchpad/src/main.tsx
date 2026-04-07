// import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { persistApiBaseForServiceWorker } from './swApiBaseCache';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.log('ServiceWorker registered:', registration.scope);
        return persistApiBaseForServiceWorker();
      })
      .catch((err) => {
        console.error('Error registering ServiceWorker:', err);
      });
  });
}

createRoot(document.getElementById('root')!).render(
  //   <StrictMode>
  <App />,
  //   </StrictMode>,
);

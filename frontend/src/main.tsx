import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './i18n/config';
import App from './App.tsx';

// Register service worker for PWA and auto-update
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js?v=2')  // v2 bump due to Cloudflare edge caching
      .then((registration) => {
        console.log('SW registered:', registration);

        // Auto-update: when new SW is waiting, reload to activate it
        if (registration.waiting) {
          console.log('New update already waiting - reloading');
          window.location.reload();
        }

        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('New update available - reloading');
                window.location.reload();
              }
            });
          }
        });
      })
      .catch((error) => {
        console.error('SW registration failed:', error);
      });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

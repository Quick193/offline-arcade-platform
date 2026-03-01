import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './src/App';
import './src/styles.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

const baseUrl = import.meta.env.BASE_URL || '/';
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swUrl = new URL('./sw.js', window.location.origin + baseUrl).toString();
    navigator.serviceWorker.register(swUrl, { scope: baseUrl }).catch((error) => {
      console.error('Service worker registration failed', error);
    });
  });
}

createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

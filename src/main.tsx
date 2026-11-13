import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { DBProvider } from './lib/store';
import { UIProvider } from './components/ui';
import { isSandboxed } from './lib/utils';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DBProvider>
      <UIProvider>
        <App />
      </UIProvider>
    </DBProvider>
  </React.StrictMode>,
);

// PWA : service worker (hors aperçu sandboxé et en HTTPS uniquement)
if (!isSandboxed && 'serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

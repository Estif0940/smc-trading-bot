import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Guard against benign browser warnings and extension-injected errors (e.g. MetaMask in iframes)
window.addEventListener('error', (event) => {
  const msg = event?.message || '';
  if (
    msg.includes('ResizeObserver') ||
    msg.includes('MetaMask') ||
    msg.includes('Failed to connect to MetaMask') ||
    msg.includes('ethereum') ||
    msg.includes('User rejected the request') ||
    msg.includes('User denied')
  ) {
    event.stopImmediatePropagation();
    event.preventDefault();
    return true;
  }
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const reasonStr = typeof reason === 'string' ? reason : (reason?.message || String(reason || ''));
  if (
    reasonStr.includes('Failed to connect to MetaMask') ||
    reasonStr.includes('MetaMask') ||
    reasonStr.includes('ethereum') ||
    reasonStr.includes('User rejected') ||
    reasonStr.includes('ResizeObserver') ||
    reasonStr.includes('denied')
  ) {
    event.stopImmediatePropagation();
    event.preventDefault();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);


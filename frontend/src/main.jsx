// Global API URL setup for local development / production online hosting
window.API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Polyfill Promise.withResolvers for older browser compatibility (needed by modern PDF.js)
if (typeof Promise.withResolvers === 'undefined') {
  Promise.withResolvers = function () {
    let resolve, reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

// Global browser error logger to backend server
window.addEventListener('error', (event) => {
  fetch(`${window.API_BASE_URL}/api/log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      level: 'error',
      message: `Uncaught Error: ${event.message}`,
      details: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error ? { message: event.error.message, stack: event.error.stack } : null
      }
    })
  }).catch(() => {});
});

window.addEventListener('unhandledrejection', (event) => {
  fetch(`${window.API_BASE_URL}/api/log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      level: 'error',
      message: `Unhandled Promise Rejection: ${event.reason}`,
      details: event.reason ? { message: event.reason.message, stack: event.reason.stack || String(event.reason) } : null
    })
  }).catch(() => {});
});

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

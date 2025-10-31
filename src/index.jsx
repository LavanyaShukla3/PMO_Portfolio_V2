import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// CRITICAL: Unregister ALL service workers and clear caches
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for (let registration of registrations) {
      registration.unregister().then(() => {
        console.log('✅ Service Worker unregistered');
      });
    }
  });
}

// Clear all caches
if ('caches' in window) {
  caches.keys().then(function(names) {
    for (let name of names) {
      caches.delete(name);
    }
    console.log('✅ Service Worker caches cleared');
  });
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

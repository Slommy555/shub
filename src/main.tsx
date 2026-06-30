import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import UpdateToast from './components/UpdateToast';
import './index.css';

// UpdateToast registers the service worker (so reminders can fire OS
// notifications and the app is installable) and surfaces a "Refresh" prompt
// when a new build is available. It lives outside <App> so it shows on every
// screen, including login.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <UpdateToast />
  </React.StrictMode>
);

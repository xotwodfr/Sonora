import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { useUIStore } from './stores/uiStore';
import { usePlayerStore } from './stores/playerStore';
import { initDynamicTheme } from './stores/themeStore';
import './styles/index.css';

// Apply the persisted theme before first paint to avoid a flash of the wrong scheme.
const initialTheme = localStorage.getItem('sonora-ui')
  ? (JSON.parse(localStorage.getItem('sonora-ui') as string) as { state?: { theme?: 'dark' | 'light' } }).state?.theme
  : undefined;
useUIStore.getState().setTheme(initialTheme && (initialTheme === 'light' || initialTheme === 'dark') ? initialTheme : 'dark');

// Restore persisted queue + audio element early (before React renders).
void usePlayerStore.getState().init();

// Initialize dynamic theme system (album-art color extraction).
initDynamicTheme();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
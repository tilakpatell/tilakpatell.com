import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/archivo/wdth.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import './index.css';
import './styles/extras.css';
import './styles/caribbean-themes.css';
import './styles/middleearth-themes.css';
import './styles/fan-dark-themes.css';
import App from './App.jsx';
import { cleanHref } from './lib/stale';
import { registerWorker } from './lib/sw';

// (back from a reload for the new build: the address as it was)
const clean = cleanHref(window.location.href);
if (clean) window.history.replaceState(window.history.state, '', clean);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// back on for a visitor with a world installed (public/sw.js serves its pack)
registerWorker();

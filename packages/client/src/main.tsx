import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { applyPaletteToCss } from './render/palette';
import { App } from './ui/App';
import '@fontsource/cinzel/latin-600.css';
import '@fontsource/cinzel/latin-700.css';
import '@fontsource/eb-garamond/latin-400.css';
import '@fontsource/eb-garamond/latin-400-italic.css';
import '@fontsource/eb-garamond/latin-500.css';
import '@fontsource/eb-garamond/latin-600.css';
import './ui/hud.css';

applyPaletteToCss(document.documentElement);

const root = document.getElementById('root');
if (!root) throw new Error('missing #root');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

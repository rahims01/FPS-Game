import { createRoot } from 'react-dom/client';
import { App } from './App';
// Self-hosted so they load on school networks that block font CDNs. Latin only: other scripts fall back to system fonts.
import '@fontsource/saira-condensed/latin-600.css';
import '@fontsource/saira-condensed/latin-700.css';
import '@fontsource/saira-condensed/latin-800.css';
import '@fontsource/saira/latin-400.css';
import '@fontsource/saira/latin-500.css';
import '@fontsource/saira/latin-600.css';
import './styles/base.css';
import './styles/menu.css';
import './styles/hud.css';
import './styles/panels.css';
import './styles/cosmetics.css';

createRoot(document.getElementById('root')!).render(<App />);

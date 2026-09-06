import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './app/styles.css';

// Bewusst ohne StrictMode: der doppelte Effekt-Durchlauf im Development
// startet AudioContext und Mikrofon zweimal, was beides nicht mag.
createRoot(document.getElementById('root')!).render(<App />);

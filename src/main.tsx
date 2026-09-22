import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import './mono/tokens.css';
import './mono/mono.css';
/* Self-hosted Mono fonts (Fontsource, bundled locally — offline + PWA safe). */
import '@fontsource/cal-sans/400.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/600.css';
import '@fontsource/literata/400.css';
import '@fontsource/literata/400-italic.css';
import '@fontsource/literata/500.css';
import '@fontsource/literata/600.css';
import '@fontsource/source-serif-4/400.css';
import '@fontsource/source-serif-4/400-italic.css';
import '@fontsource/source-serif-4/600.css';
import '@fontsource/fraunces/400.css';
import '@fontsource/fraunces/500.css';
import '@fontsource/fraunces/600.css';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/dm-sans/700.css';
import App from './App';
import AppErrorBoundary from './components/AppErrorBoundary';
import { AuthProvider } from './lib/authProvider';
import { initSentry } from './lib/sentry';
import { applyAtmosphere, loadAtmosphere } from './mono/atmosphere';

/* Apply stored atmosphere before first paint so theme fonts hit body/Tailwind. */
applyAtmosphere(loadAtmosphere());
void initSentry();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </AppErrorBoundary>
  </StrictMode>,
);

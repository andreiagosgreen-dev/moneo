import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { AuthProvider } from './lib/authProvider';
import { loadLocale, preloadLocale } from './lib/i18n';
import { initSentry } from './lib/observability/sentry';

// No-op unless VITE_SENTRY_DSN is set (Roadmap Faza 5A). Fire-and-forget:
// never blocks first render, unlike the locale preload below.
void initSentry();

/**
 * Fetch the saved locale's dictionary before the first render so no screen
 * ever flashes English while a non-English dictionary loads (Roadmap Faza
 * 1.3 — i18n code splitting). `preloadLocale` is a no-op for `en`, which
 * stays bundled at boot; for any other saved locale this is one small,
 * same-origin chunk fetch that resolves in single-digit milliseconds.
 */
void preloadLocale(loadLocale()).finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </StrictMode>,
  );
});

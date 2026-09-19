import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import { AuthProvider } from './lib/authProvider';
import { loadLocale, preloadLocale } from './lib/i18n';

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
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </StrictMode>,
  );
});

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import { AuthProvider } from './lib/authProvider';
import { initSentry, SentryErrorBoundary } from './lib/sentry';

initSentry();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SentryErrorBoundary
      fallback={
        <div className="flex min-h-screen items-center justify-center px-4 text-center">
          <div>
            <p className="font-display text-lg font-semibold text-cream">Something went wrong.</p>
            <p className="mt-1 text-sm text-faint">
              Your local data is untouched. Reloading usually fixes this.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="press btn-primary mt-4 rounded-xl px-4 py-2 text-sm font-semibold"
            >
              Reload
            </button>
          </div>
        </div>
      }
    >
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </SentryErrorBoundary>
  </StrictMode>,
);

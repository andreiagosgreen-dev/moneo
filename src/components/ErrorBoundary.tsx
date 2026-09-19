import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportError } from '../lib/observability/sentry';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Top-level crash guard (Roadmap Faza 5A). Before this existed, any
 * uncaught render error produced a blank white screen with nothing in the
 * UI and, unless someone happened to check the browser console, nothing
 * reported anywhere either.
 *
 * Deliberately minimal: reload is the only recovery action, because local
 * state (localStorage) is what a partial in-memory fix could corrupt —
 * reloading re-reads from the same persisted, last-known-good state.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    void reportError(error, { componentStack: info.componentStack ?? undefined });
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-ink px-4">
        <div className="w-full max-w-sm rounded-2xl border border-line bg-card px-6 py-7 text-center">
          <h1 className="font-display text-lg font-bold text-cream">Something went wrong</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-faint">
            Your data is safe on this device. Reloading usually fixes it.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="press btn-accent mt-5 flex h-10 w-full items-center justify-center rounded-xl font-display text-sm font-bold"
          >
            Reload Moneo
          </button>
        </div>
      </div>
    );
  }
}

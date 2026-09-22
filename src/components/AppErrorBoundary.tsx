import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportError } from '../lib/sentry';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * FE safety net. Always present; reports to Sentry only when init succeeded.
 */
export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    reportError(error, { componentStack: info.componentStack ?? '' });
  }

  private reload = () => {
    this.setState({ error: null });
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div
        role="alert"
        className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ink px-6 text-center"
      >
        <h1 className="font-display text-2xl font-bold text-cream">Something went wrong</h1>
        <p className="max-w-sm text-[13px] leading-relaxed text-sage">
          Moneo hit an unexpected error. Your local data is still on this device — reload to
          continue.
        </p>
        <button
          type="button"
          onClick={this.reload}
          className="press btn-accent rounded-lg px-5 py-2 font-display text-sm font-bold"
        >
          Reload
        </button>
      </div>
    );
  }
}

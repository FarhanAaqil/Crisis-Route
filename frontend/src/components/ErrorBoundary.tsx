import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-lg max-w-2xl mx-auto my-6 text-xs text-rose-900 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold">⚠️</span>
            <h2 className="text-sm font-bold text-rose-800">
              {this.props.fallbackTitle || 'Component Error Encountered'}
            </h2>
          </div>
          <p className="text-rose-700">
            {this.state.error?.message || 'An unexpected operational UI rendering error occurred.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-3 py-1 bg-rose-700 text-white rounded font-medium hover:bg-rose-800 transition"
          >
            Retry Component
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

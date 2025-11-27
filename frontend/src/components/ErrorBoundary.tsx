import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{
          padding: '20px',
          margin: '20px 0',
          backgroundColor: 'var(--danger-bg, #fee)',
          border: '1px solid var(--danger, #f00)',
          borderRadius: '8px',
          color: 'var(--text-primary)'
        }}>
          <h3 style={{ margin: '0 0 10px 0' }}>⚠️ Something went wrong</h3>
          <details style={{ cursor: 'pointer' }}>
            <summary>Show error details</summary>
            <pre style={{
              marginTop: '10px',
              padding: '10px',
              backgroundColor: 'var(--card-bg)',
              borderRadius: '4px',
              overflow: 'auto',
              fontSize: '0.85em'
            }}>
              {this.state.error?.toString()}
              {'\n'}
              {this.state.error?.stack}
            </pre>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

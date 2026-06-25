import React from 'react';
import AppShell from './components/layout/AppShell';
import './styles/globals.css';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: 40, fontFamily: 'monospace', color: '#ff3b30',
          background: '#1c1c1e', height: '100vh', overflow: 'auto'
        }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: 16 }}>Application Error</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.8rem', color: '#ff453a' }}>
            {this.state.error?.message}
          </pre>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.7rem', color: '#a1a1a6', marginTop: 12 }}>
            {this.state.error?.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <ErrorBoundary>
      <AppShell />
    </ErrorBoundary>
  );
}

export default App;

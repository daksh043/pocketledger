import { Component, StrictMode, type ErrorInfo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Do not send errors or potentially sensitive state to external services.
  }
  render() {
    if (this.state.failed) return <main className="panel"><h1>PocketLedger could not open</h1><p>Your stored ledger has not been deleted. Reload the app, or check that browser storage is enabled. Do not clear site data without a backup.</p><button onClick={() => window.location.reload()}>Reload</button></main>;
    return this.props.children;
  }
}
const root = document.getElementById('root');
if (!root) throw new Error('Application root is missing.');
createRoot(root).render(<StrictMode><ErrorBoundary><App /></ErrorBoundary></StrictMode>);

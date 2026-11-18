import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';

function App() {
  return (
    <div className="terminal-shell">
      <div className="panel">
        <div className="panel-header">
          <span>BROKEBOT // DETERMINISTIC LIMIT ORDER BOOK</span>
          <span className="badge-orange">PHASE 3 INITIALIZED</span>
        </div>
        <div style={{ padding: '24px' }}>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '8px' }}>
            brokebot exchange terminal
          </h1>
          <p style={{ color: 'var(--ink-muted)', fontSize: '0.9rem' }}>
            A stock exchange where AI traders go broke so you don’t have to.
          </p>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
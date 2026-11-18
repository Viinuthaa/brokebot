import React from 'react';
import ReactDOM from 'react-dom/client';
import { TopTickerBar } from './components/TopTickerBar';
import { useExchangeSocket } from './hooks/useExchangeSocket';
import './styles.css';

function App() {
  const {
    status,
    liveState,
    replayState,
    lastError,
    togglePause,
    resetExchange,
  } = useExchangeSocket();

  return (
    <div className="terminal-shell">
      <TopTickerBar
        status={status}
        state={liveState}
        isReplaying={replayState !== null}
        replaySeq={replayState?.seq}
        onTogglePause={togglePause}
        onReset={resetExchange}
      />

      {lastError && (
        <div
          className="panel"
          style={{
            padding: '8px 14px',
            background: '#fee2e2',
            fontSize: '0.8rem',
            fontWeight: 600,
          }}
        >
          ERR: {lastError}
        </div>
      )}

      <div className="panel" style={{ padding: '18px', fontSize: '0.85rem' }}>
        <div>
          Connected to exchange stream — active orders on book:{' '}
          <strong>
            {(liveState?.book.bids.length ?? 0) + (liveState?.book.asks.length ?? 0)}
          </strong>{' '}
          levels | recent trades: <strong>{liveState?.recentTrades.length ?? 0}</strong>
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
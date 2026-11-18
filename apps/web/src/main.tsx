import React from 'react';
import ReactDOM from 'react-dom/client';
import { MarketCanvasCharts } from './components/MarketCanvasCharts';
import { OrderBookLadder } from './components/OrderBookLadder';
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

  const activeBook = replayState ? replayState.book : liveState?.book;

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

      <main
        style={{
          display: 'grid',
          gridTemplateColumns: '320px 1fr',
          gap: '12px',
          alignItems: 'start',
        }}
      >
        <OrderBookLadder book={activeBook} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <MarketCanvasCharts
            book={activeBook}
            recentTrades={liveState?.recentTrades ?? []}
            fairValue={liveState?.fairValue}
          />
        </div>
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
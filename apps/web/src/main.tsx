import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { AIReasoningFeed } from './components/AIReasoningFeed';
import { LeaderboardPanel } from './components/LeaderboardPanel';
import { MarketCanvasCharts } from './components/MarketCanvasCharts';
import { OrderBookLadder } from './components/OrderBookLadder';
import { OrderTicketPanel } from './components/OrderTicketPanel';
import { ReplayScrubberBar } from './components/ReplayScrubberBar';
import { TopTickerBar } from './components/TopTickerBar';
import { useExchangeSocket } from './hooks/useExchangeSocket';
import './styles.css';

function App() {
  const {
    status,
    liveState,
    replayState,
    lastError,
    placeOrder,
    togglePause,
    triggerShock,
    resetExchange,
    queryReplay,
    exitReplay,
  } = useExchangeSocket();

  const [selectedPrice, setSelectedPrice] = useState<number | null>(null);

  const activeBook = replayState ? replayState.book : liveState?.book;
  const activeLeaderboard = replayState
    ? replayState.leaderboard
    : (liveState?.leaderboard ?? []);

  const humanAccount = activeLeaderboard.find((t) => t.traderId === 'human-desk');

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

      <ReplayScrubberBar
        maxSeq={liveState?.seq ?? 0}
        replaySeq={replayState?.seq ?? null}
        disabled={status !== 'LIVE'}
        onScrub={queryReplay}
        onExitReplay={exitReplay}
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
          gridTemplateColumns: '320px 1fr 360px',
          gap: '12px',
          alignItems: 'start',
        }}
      >
        <OrderBookLadder
          book={activeBook}
          onSelectPrice={(price) => setSelectedPrice(price)}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <MarketCanvasCharts
            book={activeBook}
            recentTrades={liveState?.recentTrades ?? []}
            fairValue={liveState?.fairValue}
          />
          <LeaderboardPanel traders={activeLeaderboard} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <OrderTicketPanel
            selectedPrice={selectedPrice}
            midPrice={activeBook?.midPrice}
            humanAccount={humanAccount}
            disabled={status !== 'LIVE' || replayState !== null}
            onPlaceOrder={placeOrder}
            onTriggerShock={triggerShock}
          />
          <AIReasoningFeed thoughts={liveState?.aiThoughts ?? []} />
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
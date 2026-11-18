import { ConnectionStatus } from '../hooks/useExchangeSocket';
import { TickPayload } from '../types';

interface TopTickerBarProps {
  status: ConnectionStatus;
  state: TickPayload | null;
  isReplaying: boolean;
  replaySeq?: number;
  onTogglePause: (paused: boolean) => void;
  onReset: () => void;
}

function formatTicks(ticks: number | null | undefined): string {
  if (ticks === null || ticks === undefined) return '---';
  return `$${(ticks / 100).toFixed(2)}`;
}

export function TopTickerBar({
  status,
  state,
  isReplaying,
  replaySeq,
  onTogglePause,
  onReset,
}: TopTickerBarProps) {
  const spread = state?.book.spread;
  const paused = state?.paused ?? false;

  return (
    <header
      className="panel"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        flexWrap: 'wrap',
        gap: '12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span
          className="display-font"
          style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.03em' }}
        >
          BROKEBOT
        </span>
        <span className="badge-orange">BRK-USD</span>
        <span
          style={{
            fontSize: '0.72rem',
            fontWeight: 700,
            padding: '2px 8px',
            border: '1.5px solid var(--ink)',
            background:
              status === 'LIVE'
                ? '#dcfce7'
                : status === 'CONNECTING'
                  ? '#fef9c3'
                  : '#fee2e2',
            color: 'var(--ink)',
          }}
        >
          {isReplaying ? `REPLAY @ SEQ #${replaySeq}` : status}
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
          fontSize: '0.8rem',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <span style={{ color: 'var(--ink-muted)', marginRight: '6px' }}>MARK</span>
          <strong>{formatTicks(state?.markPrice)}</strong>
        </div>
        <div>
          <span style={{ color: 'var(--ink-muted)', marginRight: '6px' }}>FAIR</span>
          <strong>{formatTicks(state?.fairValue)}</strong>
        </div>
        <div>
          <span style={{ color: 'var(--ink-muted)', marginRight: '6px' }}>SPREAD</span>
          <strong>{spread !== null && spread !== undefined ? `${spread}t` : '---'}</strong>
        </div>
        <div>
          <span style={{ color: 'var(--ink-muted)', marginRight: '6px' }}>SEQ</span>
          <strong>#{state?.seq ?? 0}</strong>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          type="button"
          className="btn-brutal"
          onClick={() => onTogglePause(!paused)}
          disabled={status !== 'LIVE'}
        >
          {paused ? 'RESUME' : 'PAUSE'}
        </button>
        <button
          type="button"
          className="btn-brutal btn-orange"
          onClick={onReset}
          disabled={status !== 'LIVE'}
        >
          RESET SIM
        </button>
      </div>
    </header>
  );
}
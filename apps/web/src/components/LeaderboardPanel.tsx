import { TraderStats } from '../types';

interface LeaderboardPanelProps {
  traders: TraderStats[];
}

function formatMoney(cents: number): string {
  const dollars = cents / 100;
  const sign = dollars < 0 ? '-' : '';
  return `${sign}$${Math.abs(dollars).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatSignedPnL(cents: number): string {
  const dollars = cents / 100;
  const sign = dollars > 0 ? '+' : dollars < 0 ? '-' : '';
  return `${sign}$${Math.abs(dollars).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function LeaderboardPanel({ traders }: LeaderboardPanelProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <span>LIVE PNL & RISK LEADERBOARD</span>
        <span>{traders.length} PARTICIPANTS</span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '0.76rem',
          }}
        >
          <thead>
            <tr
              style={{
                borderBottom: '1.5px solid var(--ink)',
                background: 'var(--bg-cream-alt)',
                textAlign: 'left',
                fontSize: '0.68rem',
                color: 'var(--ink-muted)',
              }}
            >
              <th style={{ padding: '7px 10px' }}>#</th>
              <th style={{ padding: '7px 10px' }}>TRADER</th>
              <th style={{ padding: '7px 10px', textAlign: 'right' }}>POS</th>
              <th style={{ padding: '7px 10px', textAlign: 'right' }}>EQUITY</th>
              <th style={{ padding: '7px 10px', textAlign: 'right' }}>TOTAL PNL</th>
              <th style={{ padding: '7px 10px', textAlign: 'right' }}>SHARPE</th>
              <th style={{ padding: '7px 10px', textAlign: 'right' }}>MAX DD</th>
            </tr>
          </thead>
          <tbody>
            {traders.map((t, idx) => {
              const pnlColor =
                t.totalPnL > 0
                  ? 'var(--bid-green)'
                  : t.totalPnL < 0
                    ? 'var(--ask-red)'
                    : 'var(--ink)';
              const isHuman = t.traderId === 'human-desk';

              return (
                <tr
                  key={t.traderId}
                  style={{
                    borderBottom: '1px solid rgba(17, 17, 17, 0.12)',
                    background: isHuman ? 'var(--accent-orange-soft)' : 'transparent',
                  }}
                >
                  <td style={{ padding: '7px 10px', fontWeight: 700 }}>{idx + 1}</td>
                  <td style={{ padding: '7px 10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <strong style={{ fontWeight: isHuman ? 700 : 600 }}>{t.name}</strong>
                      {t.isLLM && (
                        <span
                          className="badge-orange"
                          style={{ fontSize: '0.6rem', padding: '1px 4px' }}
                        >
                          AI
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '7px 10px', textAlign: 'right' }}>{t.position}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 600 }}>
                    {formatMoney(t.equity)}
                  </td>
                  <td
                    style={{
                      padding: '7px 10px',
                      textAlign: 'right',
                      fontWeight: 700,
                      color: pnlColor,
                    }}
                  >
                    {formatSignedPnL(t.totalPnL)}
                  </td>
                  <td style={{ padding: '7px 10px', textAlign: 'right' }}>
                    {t.sharpeRatio.toFixed(2)}
                  </td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', color: 'var(--ink-muted)' }}>
                    {t.maxDrawdownPct.toFixed(1)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
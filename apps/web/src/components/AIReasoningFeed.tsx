import { AIThoughtLog } from '../types';

interface AIReasoningFeedProps {
  thoughts: AIThoughtLog[];
}

export function AIReasoningFeed({ thoughts }: AIReasoningFeedProps) {
  return (
    <section className="panel" style={{ height: '320px' }}>
      <div className="panel-header">
        <span>AI AGENT REASONING STREAM</span>
        <span className="badge-orange">{thoughts.length} LOGS</span>
      </div>

      <div
        style={{
          overflowY: 'auto',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {thoughts.length === 0 ? (
          <div
            style={{
              padding: '20px',
              fontSize: '0.78rem',
              color: 'var(--ink-muted)',
            }}
          >
            Waiting for AI agents to evaluate order book...
          </div>
        ) : (
          thoughts.map((t) => {
            const actionColor =
              t.decision.action === 'BUY'
                ? 'var(--bid-green)'
                : t.decision.action === 'SELL'
                  ? 'var(--ask-red)'
                  : 'var(--ink-muted)';

            return (
              <article
                key={t.id}
                style={{
                  padding: '10px 12px',
                  borderBottom: '1.5px solid var(--ink)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '5px',
                  fontSize: '0.76rem',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <strong>{t.name}</strong>
                    <span
                      style={{
                        fontSize: '0.65rem',
                        padding: '1px 5px',
                        border: '1px solid var(--ink)',
                        background: 'var(--bg-cream-alt)',
                      }}
                    >
                      {t.source === 'LLM_API' ? 'LLM' : 'HEURISTIC'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        fontWeight: 700,
                        color: actionColor,
                      }}
                    >
                      {t.decision.action}
                      {t.decision.action !== 'HOLD' ? ` ${t.decision.qty}` : ''}
                    </span>
                    <span style={{ color: 'var(--ink-muted)', fontSize: '0.7rem' }}>
                      {Math.round(t.decision.confidence * 100)}%
                    </span>
                  </div>
                </div>

                <p style={{ color: 'var(--ink)', lineHeight: 1.4 }}>
                  “{t.decision.reasoning}”
                </p>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
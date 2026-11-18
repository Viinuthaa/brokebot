import { BookLevel, BookSnapshot } from '../types';

interface OrderBookLadderProps {
  book: BookSnapshot | null | undefined;
  onSelectPrice?: (price: number) => void;
}

interface LadderRow extends BookLevel {
  cumulative: number;
}

function formatPrice(ticks: number): string {
  return (ticks / 100).toFixed(2);
}

export function OrderBookLadder({ book, onSelectPrice }: OrderBookLadderProps) {
  const rawAsks = (book?.asks ?? []).slice(0, 12);
  const rawBids = (book?.bids ?? []).slice(0, 12);

  let askCum = 0;
  const asksWithCum: LadderRow[] = rawAsks.map((lvl) => {
    askCum += lvl.totalQty;
    return { ...lvl, cumulative: askCum };
  });
  const displayAsks = [...asksWithCum].reverse();

  let bidCum = 0;
  const displayBids: LadderRow[] = rawBids.map((lvl) => {
    bidCum += lvl.totalQty;
    return { ...lvl, cumulative: bidCum };
  });

  const maxDepth = Math.max(1, askCum, bidCum);

  return (
    <section className="panel" style={{ minHeight: '520px' }}>
      <div className="panel-header">
        <span>ORDER BOOK // L2 DEPTH</span>
        <span>{rawBids.length + rawAsks.length} LVLS</span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          padding: '6px 12px',
          borderBottom: '1.5px solid var(--ink)',
          fontSize: '0.68rem',
          fontWeight: 700,
          color: 'var(--ink-muted)',
          textTransform: 'uppercase',
        }}
      >
        <span>PRICE</span>
        <span style={{ textAlign: 'right' }}>SIZE</span>
        <span style={{ textAlign: 'right' }}>TOTAL</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, fontSize: '0.78rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', flex: 1 }}>
          {displayAsks.map((lvl) => {
            const pct = Math.min(100, (lvl.cumulative / maxDepth) * 100);
            return (
              <div
                key={`ask-${lvl.price}`}
                onClick={() => onSelectPrice?.(lvl.price)}
                style={{
                  position: 'relative',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  padding: '4px 12px',
                  cursor: onSelectPrice ? 'pointer' : 'default',
                  borderBottom: '1px solid rgba(17, 17, 17, 0.08)',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    bottom: 0,
                    width: `${pct}%`,
                    background: 'var(--ask-bg)',
                    pointerEvents: 'none',
                  }}
                />
                <span style={{ color: 'var(--ask-red)', fontWeight: 700, zIndex: 1 }}>
                  {formatPrice(lvl.price)}
                </span>
                <span style={{ textAlign: 'right', zIndex: 1 }}>{lvl.totalQty}</span>
                <span style={{ textAlign: 'right', color: 'var(--ink-muted)', zIndex: 1 }}>
                  {lvl.cumulative}
                </span>
              </div>
            );
          })}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '7px 12px',
            background: 'var(--bg-cream-alt)',
            borderTop: '2px solid var(--ink)',
            borderBottom: '2px solid var(--ink)',
            fontWeight: 700,
            fontSize: '0.76rem',
          }}
        >
          <span>
            MID {book?.midPrice !== null && book?.midPrice !== undefined ? `$${formatPrice(book.midPrice)}` : '---'}
          </span>
          <span style={{ color: 'var(--accent-orange)' }}>
            SPREAD {book?.spread !== null && book?.spread !== undefined ? `${book.spread}t` : '---'}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          {displayBids.map((lvl) => {
            const pct = Math.min(100, (lvl.cumulative / maxDepth) * 100);
            return (
              <div
                key={`bid-${lvl.price}`}
                onClick={() => onSelectPrice?.(lvl.price)}
                style={{
                  position: 'relative',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  padding: '4px 12px',
                  cursor: onSelectPrice ? 'pointer' : 'default',
                  borderBottom: '1px solid rgba(17, 17, 17, 0.08)',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    bottom: 0,
                    width: `${pct}%`,
                    background: 'var(--bid-bg)',
                    pointerEvents: 'none',
                  }}
                />
                <span style={{ color: 'var(--bid-green)', fontWeight: 700, zIndex: 1 }}>
                  {formatPrice(lvl.price)}
                </span>
                <span style={{ textAlign: 'right', zIndex: 1 }}>{lvl.totalQty}</span>
                <span style={{ textAlign: 'right', color: 'var(--ink-muted)', zIndex: 1 }}>
                  {lvl.cumulative}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
import { FormEvent, useEffect, useState } from 'react';
import { OrderType, ShockScenario, Side, TraderStats } from '../types';

interface OrderTicketPanelProps {
  selectedPrice: number | null;
  midPrice: number | null | undefined;
  humanAccount: TraderStats | undefined;
  disabled: boolean;
  onPlaceOrder: (params: {
    side: Side;
    orderType: OrderType;
    price: number;
    qty: number;
  }) => void;
  onTriggerShock: (scenario: ShockScenario) => void;
}

export function OrderTicketPanel({
  selectedPrice,
  midPrice,
  humanAccount,
  disabled,
  onPlaceOrder,
  onTriggerShock,
}: OrderTicketPanelProps) {
  const [side, setSide] = useState<Side>('BUY');
  const [orderType, setOrderType] = useState<OrderType>('LIMIT');
  const [priceTicks, setPriceTicks] = useState<number>(10000);
  const [qty, setQty] = useState<number>(10);

  useEffect(() => {
    if (selectedPrice !== null) {
      setPriceTicks(selectedPrice);
    }
  }, [selectedPrice]);

  useEffect(() => {
    if (selectedPrice === null && midPrice && priceTicks === 10000) {
      setPriceTicks(midPrice);
    }
  }, [midPrice, selectedPrice, priceTicks]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (disabled || qty <= 0) return;
    onPlaceOrder({
      side,
      orderType,
      price: priceTicks,
      qty,
    });
  };

  const cashDollars = humanAccount ? (humanAccount.cash / 100).toFixed(2) : '50000.00';
  const pos = humanAccount?.position ?? 0;

  return (
    <section className="panel">
      <div className="panel-header">
        <span>MANUAL DESK // ORDER TICKET</span>
        <span>POS {pos}</span>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          fontSize: '0.76rem',
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <button
            type="button"
            className="btn-brutal"
            onClick={() => setSide('BUY')}
            style={{
              background: side === 'BUY' ? 'var(--bid-green)' : 'var(--bg-cream)',
              color: side === 'BUY' ? 'var(--bg-cream)' : 'var(--ink)',
            }}
          >
            BUY / LONG
          </button>
          <button
            type="button"
            className="btn-brutal"
            onClick={() => setSide('SELL')}
            style={{
              background: side === 'SELL' ? 'var(--ask-red)' : 'var(--bg-cream)',
              color: side === 'SELL' ? 'var(--bg-cream)' : 'var(--ink)',
            }}
          >
            SELL / SHORT
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontWeight: 700, fontSize: '0.68rem', color: 'var(--ink-muted)' }}>
            ORDER TYPE
          </label>
          <select
            value={orderType}
            onChange={(e) => setOrderType(e.target.value as OrderType)}
            style={{
              fontFamily: 'IBM Plex Mono, monospace',
              fontSize: '0.78rem',
              fontWeight: 600,
              padding: '6px 8px',
              border: '2px solid var(--ink)',
              background: 'var(--bg-cream)',
              color: 'var(--ink)',
            }}
          >
            <option value="LIMIT">LIMIT (GTC)</option>
            <option value="MARKET">MARKET</option>
            <option value="IOC">IOC (IMMEDIATE OR CANCEL)</option>
            <option value="FOK">FOK (FILL OR KILL)</option>
            <option value="POST_ONLY">POST_ONLY (MAKER)</option>
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontWeight: 700, fontSize: '0.68rem', color: 'var(--ink-muted)' }}>
              PRICE (TICKS)
            </label>
            <input
              type="number"
              min={1}
              step={1}
              disabled={orderType === 'MARKET'}
              value={orderType === 'MARKET' ? '' : priceTicks}
              placeholder={orderType === 'MARKET' ? 'MKT' : undefined}
              onChange={(e) => setPriceTicks(Math.max(1, Number(e.target.value)))}
              style={{
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: '0.78rem',
                fontWeight: 600,
                padding: '6px 8px',
                border: '2px solid var(--ink)',
                background: orderType === 'MARKET' ? 'var(--bg-cream-alt)' : 'var(--bg-cream)',
                color: 'var(--ink)',
                width: '100%',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontWeight: 700, fontSize: '0.68rem', color: 'var(--ink-muted)' }}>
              QUANTITY
            </label>
            <input
              type="number"
              min={1}
              max={500}
              step={1}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
              style={{
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: '0.78rem',
                fontWeight: 600,
                padding: '6px 8px',
                border: '2px solid var(--ink)',
                background: 'var(--bg-cream)',
                color: 'var(--ink)',
                width: '100%',
              }}
            />
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.7rem',
            color: 'var(--ink-muted)',
          }}
        >
          <span>AVAIL CASH: ${cashDollars}</span>
          <span>
            {orderType === 'MARKET' ? 'EXEC @ BEST' : `$${(priceTicks / 100).toFixed(2)}`}
          </span>
        </div>

        <button
          type="submit"
          className="btn-brutal btn-orange"
          disabled={disabled}
          style={{ width: '100%', padding: '9px' }}
        >
          SUBMIT {side} {orderType}
        </button>
      </form>

      <div
        style={{
          borderTop: '2px solid var(--ink)',
          padding: '12px',
          background: 'var(--bg-cream-alt)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <div
          style={{
            fontSize: '0.68rem',
            fontWeight: 700,
            letterSpacing: '0.05em',
            color: 'var(--ink-muted)',
          }}
        >
          CHAOS & LIQUIDITY SHOCK INJECTOR
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          <button
            type="button"
            className="btn-brutal"
            disabled={disabled}
            onClick={() => onTriggerShock('FLASH_CRASH')}
            style={{ fontSize: '0.7rem', padding: '6px 8px' }}
          >
            FLASH CRASH
          </button>
          <button
            type="button"
            className="btn-brutal"
            disabled={disabled}
            onClick={() => onTriggerShock('SHORT_SQUEEZE')}
            style={{ fontSize: '0.7rem', padding: '6px 8px' }}
          >
            SHORT SQUEEZE
          </button>
        </div>

        <button
          type="button"
          className="btn-brutal"
          disabled={disabled}
          onClick={() => onTriggerShock('LIQUIDITY_VACUUM')}
          style={{ fontSize: '0.7rem', padding: '6px 8px', width: '100%' }}
        >
          LIQUIDITY VACUUM (SWEEP BIDS)
        </button>
      </div>
    </section>
  );
}
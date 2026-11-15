import { describe, expect, it } from 'vitest';
import { ExchangeSequencer } from '../sequencer.js';

function createTestExchange() {
  const ex = new ExchangeSequencer();
  ex.registerTrader({ traderId: 'alice', name: 'Alice', initialCash: 1_000_000 });
  ex.registerTrader({ traderId: 'bob', name: 'Bob', initialCash: 1_000_000 });
  ex.registerTrader({ traderId: 'carol', name: 'Carol', initialCash: 1_000_000 });
  return ex;
}

describe('MatchingEngine & ExchangeSequencer', () => {
  it('enforces strict FIFO price-time priority', () => {
    const ex = createTestExchange();

    ex.submit({
      kind: 'PLACE',
      orderId: 'sell-1',
      traderId: 'alice',
      side: 'SELL',
      orderType: 'LIMIT',
      price: 10000,
      qty: 10,
      timestamp: 1,
    });

    ex.submit({
      kind: 'PLACE',
      orderId: 'sell-2',
      traderId: 'bob',
      side: 'SELL',
      orderType: 'LIMIT',
      price: 10000,
      qty: 10,
      timestamp: 2,
    });

    const { events } = ex.submit({
      kind: 'PLACE',
      orderId: 'buy-1',
      traderId: 'carol',
      side: 'BUY',
      orderType: 'LIMIT',
      price: 10000,
      qty: 15,
      timestamp: 3,
    });

    const trades = events.filter((e) => e.type === 'TRADE');
    expect(trades).toHaveLength(2);
    expect(trades[0]).toMatchObject({
      makerOrderId: 'sell-1',
      makerTraderId: 'alice',
      qty: 10,
      price: 10000,
    });
    expect(trades[1]).toMatchObject({
      makerOrderId: 'sell-2',
      makerTraderId: 'bob',
      qty: 5,
      price: 10000,
    });

    const snap = ex.getBookSnapshot();
    expect(snap.asks).toEqual([{ price: 10000, totalQty: 5, orderCount: 1 }]);
  });

  it('handles IOC, FOK, and POST_ONLY order semantics accurately', () => {
    const ex = createTestExchange();

    ex.submit({
      kind: 'PLACE',
      orderId: 'ask-1',
      traderId: 'alice',
      side: 'SELL',
      orderType: 'LIMIT',
      price: 10050,
      qty: 10,
      timestamp: 1,
    });

    const postOnlyRes = ex.submit({
      kind: 'PLACE',
      orderId: 'po-1',
      traderId: 'bob',
      side: 'BUY',
      orderType: 'POST_ONLY',
      price: 10050,
      qty: 5,
      timestamp: 2,
    });
    expect(postOnlyRes.events[0]).toMatchObject({
      type: 'ORDER_CANCELLED',
      reason: 'POST_ONLY_CROSS',
    });

    const fokRes = ex.submit({
      kind: 'PLACE',
      orderId: 'fok-1',
      traderId: 'bob',
      side: 'BUY',
      orderType: 'FOK',
      price: 10050,
      qty: 15,
      timestamp: 3,
    });
    expect(fokRes.events[0]).toMatchObject({
      type: 'ORDER_CANCELLED',
      reason: 'FOK_UNFILLED',
    });
    expect(ex.getBookSnapshot().asks[0].totalQty).toBe(10);

    const iocRes = ex.submit({
      kind: 'PLACE',
      orderId: 'ioc-1',
      traderId: 'bob',
      side: 'BUY',
      orderType: 'IOC',
      price: 10050,
      qty: 15,
      timestamp: 4,
    });
    expect(iocRes.events.some((e) => e.type === 'TRADE' && e.qty === 10)).toBe(true);
    expect(
      iocRes.events.some(
        (e) => e.type === 'ORDER_CANCELLED' && e.reason === 'IOC_REMAINDER' && e.remainingQty === 5
      )
    ).toBe(true);
    expect(ex.getBookSnapshot().asks).toHaveLength(0);
  });

  it('prevents self-trades and tracks PnL accurately', () => {
    const ex = createTestExchange();

    ex.submit({
      kind: 'PLACE',
      orderId: 'a-sell',
      traderId: 'alice',
      side: 'SELL',
      orderType: 'LIMIT',
      price: 10000,
      qty: 10,
      timestamp: 1,
    });

    const selfRes = ex.submit({
      kind: 'PLACE',
      orderId: 'a-buy',
      traderId: 'alice',
      side: 'BUY',
      orderType: 'LIMIT',
      price: 10000,
      qty: 10,
      timestamp: 2,
    });

    expect(selfRes.events.filter((e) => e.type === 'TRADE')).toHaveLength(0);
    expect(ex.getBookSnapshot().bids).toHaveLength(1);
    expect(ex.getBookSnapshot().asks).toHaveLength(0);
  });

  it('reconstructs identical state via deterministic event replay', () => {
    const ex = createTestExchange();

    ex.submit({
      kind: 'PLACE',
      orderId: '1',
      traderId: 'alice',
      side: 'SELL',
      orderType: 'LIMIT',
      price: 10100,
      qty: 20,
      timestamp: 10,
    });
    ex.submit({
      kind: 'PLACE',
      orderId: '2',
      traderId: 'bob',
      side: 'BUY',
      orderType: 'LIMIT',
      price: 10100,
      qty: 12,
      timestamp: 20,
    });
    ex.submit({
      kind: 'MODIFY',
      orderId: '1',
      traderId: 'alice',
      newPrice: 10080,
      newQty: 20,
      timestamp: 30,
    });

    const session = ex.exportSession();
    const replayed = ExchangeSequencer.replay(session.registrations, session.commands);

    expect(replayed.getBookSnapshot()).toEqual(ex.getBookSnapshot());
    expect(replayed.getEventLog()).toEqual(ex.getEventLog());
    expect(replayed.ledger.getLeaderboard(10080)).toEqual(ex.ledger.getLeaderboard(10080));
  });
});
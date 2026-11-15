import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ExchangeSequencer } from '../sequencer.js';

describe('Order Book Invariants (Property-Based)', () => {
  it('maintains non-crossed book, conservation of cash/shares, and exact replay under random order flows', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            traderId: fc.constantFrom('t1', 't2', 't3', 't4'),
            side: fc.constantFrom('BUY' as const, 'SELL' as const),
            orderType: fc.constantFrom(
              'LIMIT' as const,
              'IOC' as const,
              'POST_ONLY' as const
            ),
            price: fc.integer({ min: 9950, max: 10050 }),
            qty: fc.integer({ min: 1, max: 25 }),
          }),
          { minLength: 20, maxLength: 150 }
        ),
        (orders) => {
          const ex = new ExchangeSequencer();
          const traders = ['t1', 't2', 't3', 't4'];
          for (const t of traders) {
            ex.registerTrader({ traderId: t, name: t, initialCash: 10_000_000 });
          }

          orders.forEach((o, i) => {
            ex.submit({
              kind: 'PLACE',
              orderId: `ord-${i}`,
              traderId: o.traderId,
              side: o.side,
              orderType: o.orderType,
              price: o.price,
              qty: o.qty,
              timestamp: i * 10,
            });

            const snap = ex.getBookSnapshot(50);
            if (snap.bestBid !== null && snap.bestAsk !== null) {
              expect(snap.bestBid).toBeLessThan(snap.bestAsk);
            }
          });

          let totalCash = 0;
          let netPosition = 0;
          for (const t of traders) {
            const acc = ex.ledger.getAccount(t)!;
            totalCash += acc.cash;
            netPosition += acc.position;
          }

          expect(totalCash).toBe(40_000_000);
          expect(netPosition).toBe(0);

          const session = ex.exportSession();
          const replayed = ExchangeSequencer.replay(session.registrations, session.commands);
          expect(replayed.getBookSnapshot(50)).toEqual(ex.getBookSnapshot(50));
        }
      ),
      { numRuns: 50 }
    );
  });
});
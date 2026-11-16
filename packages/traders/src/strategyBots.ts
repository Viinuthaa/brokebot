import { EngineCommand } from '@lob/engine';
import { BotAgent, MarketContext } from './botTypes.js';
import { SeededRNG } from './rng.js';

export class MomentumBot implements BotAgent {
  private rng: SeededRNG;
  private orderCounter = 0;

  constructor(
    public readonly traderId: string,
    public readonly name: string,
    public readonly initialCash: number,
    seed: number,
    private readonly lookback = 8,
    private readonly thresholdTicks = 6
  ) {
    this.rng = new SeededRNG(seed);
  }

  tick(ctx: MarketContext): EngineCommand[] {
    if (ctx.recentTrades.length < this.lookback) return [];
    if (this.rng.next() > 0.45) return [];

    const slice = ctx.recentTrades.slice(-this.lookback);
    const delta = slice[slice.length - 1].price - slice[0].price;

    if (Math.abs(delta) < this.thresholdTicks) return [];

    const side = delta > 0 ? 'BUY' : 'SELL';
    const refPrice =
      side === 'BUY'
        ? (ctx.book.bestAsk ?? ctx.fairValue) + 2
        : Math.max(1, (ctx.book.bestBid ?? ctx.fairValue) - 2);

    this.orderCounter += 1;
    return [
      {
        kind: 'PLACE',
        orderId: `${this.traderId}-${this.orderCounter}`,
        traderId: this.traderId,
        side,
        orderType: 'IOC',
        price: refPrice,
        qty: this.rng.nextInt(4, 14),
        timestamp: ctx.timestamp,
      },
    ];
  }
}

export class MeanReversionBot implements BotAgent {
  private rng: SeededRNG;
  private orderCounter = 0;

  constructor(
    public readonly traderId: string,
    public readonly name: string,
    public readonly initialCash: number,
    seed: number,
    private readonly windowSize = 20,
    private readonly deviationTicks = 8
  ) {
    this.rng = new SeededRNG(seed);
  }

  tick(ctx: MarketContext): EngineCommand[] {
    if (ctx.recentTrades.length < this.windowSize) return [];
    if (this.rng.next() > 0.5) return [];

    const window = ctx.recentTrades.slice(-this.windowSize);
    const sma = window.reduce((sum, t) => sum + t.price, 0) / window.length;
    const mid = ctx.book.midPrice ?? ctx.fairValue;
    const diff = mid - sma;

    if (Math.abs(diff) < this.deviationTicks) return [];

    const side = diff > 0 ? 'SELL' : 'BUY';
    const price = side === 'SELL' ? Math.max(1, mid - 1) : mid + 1;

    this.orderCounter += 1;
    return [
      {
        kind: 'PLACE',
        orderId: `${this.traderId}-${this.orderCounter}`,
        traderId: this.traderId,
        side,
        orderType: 'LIMIT',
        price,
        qty: this.rng.nextInt(5, 15),
        timestamp: ctx.timestamp,
      },
    ];
  }
}
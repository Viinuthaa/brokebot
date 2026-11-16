import { EngineCommand } from '@lob/engine';
import { BotAgent, MarketContext } from './botTypes.js';
import { SeededRNG } from './rng.js';

export class MarketMakerBot implements BotAgent {
  private rng: SeededRNG;
  private activeBidId: string | null = null;
  private activeAskId: string | null = null;
  private orderCounter = 0;

  constructor(
    public readonly traderId: string,
    public readonly name: string,
    public readonly initialCash: number,
    seed: number,
    private readonly baseHalfSpread = 6,
    private readonly quoteQty = 15
  ) {
    this.rng = new SeededRNG(seed);
  }

  tick(ctx: MarketContext): EngineCommand[] {
    const cmds: EngineCommand[] = [];
    const mid = ctx.book.midPrice ?? ctx.fairValue;
    const inv = ctx.account.position;

    const inventorySkew = Math.round(inv * 0.04);
    const dynamicSpread = this.baseHalfSpread + Math.min(20, Math.floor(Math.abs(inv) / 25));

    const jitter = this.rng.nextInt(-1, 1);
    const bidPrice = Math.max(1, mid - dynamicSpread - inventorySkew + jitter);
    const askPrice = Math.max(bidPrice + 2, mid + dynamicSpread - inventorySkew + jitter);

    if (this.activeBidId) {
      cmds.push({
        kind: 'CANCEL',
        orderId: this.activeBidId,
        traderId: this.traderId,
        timestamp: ctx.timestamp,
      });
    }
    if (this.activeAskId) {
      cmds.push({
        kind: 'CANCEL',
        orderId: this.activeAskId,
        traderId: this.traderId,
        timestamp: ctx.timestamp,
      });
    }

    this.orderCounter += 1;
    this.activeBidId = `${this.traderId}-b-${this.orderCounter}`;
    this.activeAskId = `${this.traderId}-a-${this.orderCounter}`;

    cmds.push({
      kind: 'PLACE',
      orderId: this.activeBidId,
      traderId: this.traderId,
      side: 'BUY',
      orderType: 'POST_ONLY',
      price: bidPrice,
      qty: this.quoteQty,
      timestamp: ctx.timestamp,
    });

    cmds.push({
      kind: 'PLACE',
      orderId: this.activeAskId,
      traderId: this.traderId,
      side: 'SELL',
      orderType: 'POST_ONLY',
      price: askPrice,
      qty: this.quoteQty,
      timestamp: ctx.timestamp,
    });

    return cmds;
  }
}

export class NoiseTraderBot implements BotAgent {
  private rng: SeededRNG;
  private orderCounter = 0;

  constructor(
    public readonly traderId: string,
    public readonly name: string,
    public readonly initialCash: number,
    seed: number
  ) {
    this.rng = new SeededRNG(seed);
  }

  tick(ctx: MarketContext): EngineCommand[] {
    if (this.rng.next() > 0.65) return [];

    const mid = ctx.book.midPrice ?? ctx.fairValue;
    const side = this.rng.next() < 0.5 ? 'BUY' : 'SELL';
    const isMarket = this.rng.next() < 0.25;
    const offset = Math.round(this.rng.nextGaussian(0, 8));
    const price = Math.max(1, mid + offset);
    const qty = this.rng.nextInt(1, 12);

    this.orderCounter += 1;
    return [
      {
        kind: 'PLACE',
        orderId: `${this.traderId}-${this.orderCounter}`,
        traderId: this.traderId,
        side,
        orderType: isMarket ? 'IOC' : 'LIMIT',
        price,
        qty,
        timestamp: ctx.timestamp,
      },
    ];
  }
}
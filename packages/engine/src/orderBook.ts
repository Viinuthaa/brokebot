import { BookLevel, BookSnapshot, RestingOrder, Side } from './types.js';

export class PriceLevel {
  public readonly price: number;
  public orders: RestingOrder[] = [];
  public totalQty = 0;

  constructor(price: number) {
    this.price = price;
  }

  enqueue(order: RestingOrder): void {
    this.orders.push(order);
    this.totalQty += order.remainingQty;
  }

  peek(): RestingOrder | undefined {
    return this.orders[0];
  }

  dequeue(): RestingOrder | undefined {
    const head = this.orders.shift();
    if (head) {
      this.totalQty -= head.remainingQty;
    }
    return head;
  }

  removeOrder(orderId: string): RestingOrder | undefined {
    const idx = this.orders.findIndex((o) => o.orderId === orderId);
    if (idx === -1) return undefined;
    const [removed] = this.orders.splice(idx, 1);
    this.totalQty -= removed.remainingQty;
    return removed;
  }

  reduceHeadQty(filledQty: number): void {
    const head = this.orders[0];
    if (!head) return;
    head.remainingQty -= filledQty;
    this.totalQty -= filledQty;
    if (head.remainingQty <= 0) {
      this.orders.shift();
    }
  }

  isEmpty(): boolean {
    return this.orders.length === 0;
  }
}

export class OrderBook {
  private bidLevels: PriceLevel[] = [];
  private askLevels: PriceLevel[] = [];
  private orderIndex = new Map<string, RestingOrder>();

  getOrder(orderId: string): RestingOrder | undefined {
    return this.orderIndex.get(orderId);
  }

  hasOrder(orderId: string): boolean {
    return this.orderIndex.has(orderId);
  }

  getBestBidLevel(): PriceLevel | undefined {
    return this.bidLevels[0];
  }

  getBestAskLevel(): PriceLevel | undefined {
    return this.askLevels[0];
  }

  getBestBidPrice(): number | null {
    return this.bidLevels[0]?.price ?? null;
  }

  getBestAskPrice(): number | null {
    return this.askLevels[0]?.price ?? null;
  }

  addOrder(order: RestingOrder): void {
    if (this.orderIndex.has(order.orderId)) {
      throw new Error(`Duplicate orderId: ${order.orderId}`);
    }
    const levels = order.side === 'BUY' ? this.bidLevels : this.askLevels;
    const idx = this.findLevelIndex(levels, order.price, order.side);

    let level: PriceLevel;
    if (idx < levels.length && levels[idx].price === order.price) {
      level = levels[idx];
    } else {
      level = new PriceLevel(order.price);
      levels.splice(idx, 0, level);
    }

    level.enqueue(order);
    this.orderIndex.set(order.orderId, order);
  }

  removeOrder(orderId: string): RestingOrder | undefined {
    const order = this.orderIndex.get(orderId);
    if (!order) return undefined;

    const levels = order.side === 'BUY' ? this.bidLevels : this.askLevels;
    const idx = this.findLevelIndex(levels, order.price, order.side);
    if (idx < levels.length && levels[idx].price === order.price) {
      const level = levels[idx];
      level.removeOrder(orderId);
      if (level.isEmpty()) {
        levels.splice(idx, 1);
      }
    }

    this.orderIndex.delete(orderId);
    return order;
  }

  consumeBestLevel(side: Side, filledQty: number): void {
    const levels = side === 'BUY' ? this.bidLevels : this.askLevels;
    const bestLevel = levels[0];
    if (!bestLevel) return;

    const head = bestLevel.peek();
    if (!head) return;

    bestLevel.reduceHeadQty(filledQty);
    if (head.remainingQty <= 0) {
      this.orderIndex.delete(head.orderId);
    }
    if (bestLevel.isEmpty()) {
      levels.shift();
    }
  }

  getAvailableLiquidity(sideToConsume: Side, limitPrice: number | null): number {
    const levels = sideToConsume === 'BUY' ? this.bidLevels : this.askLevels;
    let available = 0;

    for (const level of levels) {
      if (limitPrice !== null) {
        if (sideToConsume === 'SELL' && level.price > limitPrice) break;
        if (sideToConsume === 'BUY' && level.price < limitPrice) break;
      }
      available += level.totalQty;
    }
    return available;
  }

  getSnapshot(seq: number, depth = 20): BookSnapshot {
    const bids: BookLevel[] = this.bidLevels.slice(0, depth).map((l) => ({
      price: l.price,
      totalQty: l.totalQty,
      orderCount: l.orders.length,
    }));
    const asks: BookLevel[] = this.askLevels.slice(0, depth).map((l) => ({
      price: l.price,
      totalQty: l.totalQty,
      orderCount: l.orders.length,
    }));

    const bestBid = bids[0]?.price ?? null;
    const bestAsk = asks[0]?.price ?? null;
    const midPrice =
      bestBid !== null && bestAsk !== null ? Math.round((bestBid + bestAsk) / 2) : null;
    const spread =
      bestBid !== null && bestAsk !== null ? bestAsk - bestBid : null;

    return { seq, bids, asks, bestBid, bestAsk, midPrice, spread };
  }

  private findLevelIndex(levels: PriceLevel[], price: number, side: Side): number {
    let low = 0;
    let high = levels.length;

    while (low < high) {
      const mid = (low + high) >>> 1;
      const midPrice = levels[mid].price;
      const shouldGoRight = side === 'BUY' ? midPrice > price : midPrice < price;
      if (shouldGoRight) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    return low;
  }
}
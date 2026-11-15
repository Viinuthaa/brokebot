import { RiskValidator } from './matchingEngine.js';
import { PlaceOrderCommand, RestingOrder, Side } from './types.js';

export interface RiskLimits {
  maxOrderQty: number;
  maxPosition: number;
  allowShort: boolean;
}

export interface TraderAccount {
  traderId: string;
  name: string;
  isLLM: boolean;
  initialCash: number;
  cash: number;
  position: number;
  avgEntryPrice: number;
  realizedPnL: number;
  tradeCount: number;
  volumeTraded: number;
  peakEquity: number;
  maxDrawdown: number;
  returnsHistory: number[];
  lastEquity: number;
}

export interface TraderStats {
  traderId: string;
  name: string;
  isLLM: boolean;
  cash: number;
  position: number;
  realizedPnL: number;
  unrealizedPnL: number;
  totalPnL: number;
  equity: number;
  sharpeRatio: number;
  maxDrawdownPct: number;
  tradeCount: number;
}

export class AccountLedger implements RiskValidator {
  private accounts = new Map<string, TraderAccount>();
  private readonly defaultLimits: RiskLimits = {
    maxOrderQty: 500,
    maxPosition: 2000,
    allowShort: true,
  };

  constructor(private readonly limits: Partial<RiskLimits> = {}) {
    this.defaultLimits = { ...this.defaultLimits, ...limits };
  }

  registerTrader(traderId: string, name: string, initialCash: number, isLLM = false): void {
    if (this.accounts.has(traderId)) return;
    this.accounts.set(traderId, {
      traderId,
      name,
      isLLM,
      initialCash,
      cash: initialCash,
      position: 0,
      avgEntryPrice: 0,
      realizedPnL: 0,
      tradeCount: 0,
      volumeTraded: 0,
      peakEquity: initialCash,
      maxDrawdown: 0,
      returnsHistory: [],
      lastEquity: initialCash,
    });
  }

  getAccount(traderId: string): TraderAccount | undefined {
    return this.accounts.get(traderId);
  }

  validateOrder(cmd: PlaceOrderCommand): string | null {
    const acc = this.accounts.get(cmd.traderId);
    if (!acc) return 'UNKNOWN_TRADER';

    if (cmd.qty > this.defaultLimits.maxOrderQty) {
      return `MAX_ORDER_QTY_EXCEEDED (${this.defaultLimits.maxOrderQty})`;
    }

    const projectedPos =
      cmd.side === 'BUY' ? acc.position + cmd.qty : acc.position - cmd.qty;

    if (Math.abs(projectedPos) > this.defaultLimits.maxPosition) {
      return `MAX_POSITION_EXCEEDED (${this.defaultLimits.maxPosition})`;
    }

    if (!this.defaultLimits.allowShort && projectedPos < 0) {
      return 'SHORT_SELLING_DISABLED';
    }

    if (cmd.side === 'BUY') {
      const estPrice = cmd.orderType === 'MARKET' ? 100_000 : cmd.price;
      const requiredCash = estPrice * cmd.qty;
      if (acc.cash < requiredCash) {
        return 'INSUFFICIENT_CASH';
      }
    }

    return null;
  }

  validateModify(order: RestingOrder, newPrice: number, newQty: number): string | null {
    const acc = this.accounts.get(order.traderId);
    if (!acc) return 'UNKNOWN_TRADER';
    if (newQty > this.defaultLimits.maxOrderQty) {
      return `MAX_ORDER_QTY_EXCEEDED (${this.defaultLimits.maxOrderQty})`;
    }
    if (order.side === 'BUY' && acc.cash < newPrice * newQty) {
      return 'INSUFFICIENT_CASH';
    }
    return null;
  }

  onTrade(
    makerTraderId: string,
    takerTraderId: string,
    takerSide: Side,
    price: number,
    qty: number
  ): void {
    const buyerId = takerSide === 'BUY' ? takerTraderId : makerTraderId;
    const sellerId = takerSide === 'SELL' ? takerTraderId : makerTraderId;

    this.applyFill(buyerId, 'BUY', price, qty);
    this.applyFill(sellerId, 'SELL', price, qty);
  }

  private applyFill(traderId: string, side: Side, price: number, qty: number): void {
    const acc = this.accounts.get(traderId);
    if (!acc) return;

    const signedQty = side === 'BUY' ? qty : -qty;
    acc.cash -= signedQty * price;
    acc.tradeCount += 1;
    acc.volumeTraded += qty;

    if (acc.position === 0 || Math.sign(acc.position) === Math.sign(signedQty)) {
      const totalCost = acc.avgEntryPrice * Math.abs(acc.position) + price * qty;
      acc.position += signedQty;
      acc.avgEntryPrice = acc.position !== 0 ? totalCost / Math.abs(acc.position) : 0;
    } else {
      const closedQty = Math.min(Math.abs(acc.position), qty);
      const pnlPerUnit =
        acc.position > 0 ? price - acc.avgEntryPrice : acc.avgEntryPrice - price;
      acc.realizedPnL += closedQty * pnlPerUnit;
      acc.position += signedQty;
      if (acc.position === 0) {
        acc.avgEntryPrice = 0;
      } else if (Math.sign(acc.position) === Math.sign(signedQty)) {
        acc.avgEntryPrice = price;
      }
    }

    this.recordMarkToMarket(acc, price);
  }

  recordMarkToMarket(acc: TraderAccount, markPrice: number): void {
    const equity = acc.cash + acc.position * markPrice;
    if (equity > acc.peakEquity) {
      acc.peakEquity = equity;
    }
    const dd = acc.peakEquity > 0 ? (acc.peakEquity - equity) / acc.peakEquity : 0;
    if (dd > acc.maxDrawdown) {
      acc.maxDrawdown = dd;
    }
    if (acc.lastEquity > 0 && equity !== acc.lastEquity) {
      const ret = (equity - acc.lastEquity) / acc.lastEquity;
      acc.returnsHistory.push(ret);
      if (acc.returnsHistory.length > 200) acc.returnsHistory.shift();
    }
    acc.lastEquity = equity;
  }

  getLeaderboard(markPrice: number): TraderStats[] {
    const stats: TraderStats[] = [];
    for (const acc of this.accounts.values()) {
      const unrealizedPnL =
        acc.position !== 0
          ? (markPrice - acc.avgEntryPrice) * acc.position
          : 0;
      const equity = acc.cash + acc.position * markPrice;
      const totalPnL = equity - acc.initialCash;

      stats.push({
        traderId: acc.traderId,
        name: acc.name,
        isLLM: acc.isLLM,
        cash: acc.cash,
        position: acc.position,
        realizedPnL: Math.round(acc.realizedPnL),
        unrealizedPnL: Math.round(unrealizedPnL),
        totalPnL: Math.round(totalPnL),
        equity: Math.round(equity),
        sharpeRatio: this.computeSharpe(acc.returnsHistory),
        maxDrawdownPct: Number((acc.maxDrawdown * 100).toFixed(2)),
        tradeCount: acc.tradeCount,
      });
    }
    return stats.sort((a, b) => b.totalPnL - a.totalPnL);
  }

  private computeSharpe(returns: number[]): number {
    if (returns.length < 5) return 0;
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance =
      returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (returns.length - 1);
    const std = Math.sqrt(variance);
    if (std === 0) return 0;
    return Number(((mean / std) * Math.sqrt(252)).toFixed(2));
  }
}
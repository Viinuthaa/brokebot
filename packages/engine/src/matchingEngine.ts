import { OrderBook } from './orderBook.js';
import {
  CancelOrderCommand,
  EngineCommand,
  EngineEvent,
  ModifyOrderCommand,
  PlaceOrderCommand,
  RestingOrder,
  Side,
} from './types.js';

export interface RiskValidator {
  validateOrder(cmd: PlaceOrderCommand): string | null;
  validateModify(order: RestingOrder, newPrice: number, newQty: number): string | null;
  onTrade(
    makerTraderId: string,
    takerTraderId: string,
    takerSide: Side,
    price: number,
    qty: number
  ): void;
}

export class MatchingEngine {
  public readonly book = new OrderBook();
  private tradeCounter = 0;

  constructor(private readonly riskValidator?: RiskValidator) {}

  process(seq: number, command: EngineCommand): EngineEvent[] {
    switch (command.kind) {
      case 'PLACE':
        return this.handlePlace(seq, command);
      case 'CANCEL':
        return this.handleCancel(seq, command);
      case 'MODIFY':
        return this.handleModify(seq, command);
    }
  }

  private handlePlace(seq: number, cmd: PlaceOrderCommand): EngineEvent[] {
    const events: EngineEvent[] = [];

    if (this.book.hasOrder(cmd.orderId)) {
      events.push({
        type: 'ORDER_REJECTED',
        seq,
        orderId: cmd.orderId,
        traderId: cmd.traderId,
        reason: 'DUPLICATE_ORDER_ID',
        timestamp: cmd.timestamp,
      });
      return events;
    }

    if (cmd.orderType !== 'MARKET' && cmd.price <= 0) {
      events.push({
        type: 'ORDER_REJECTED',
        seq,
        orderId: cmd.orderId,
        traderId: cmd.traderId,
        reason: 'INVALID_PRICE',
        timestamp: cmd.timestamp,
      });
      return events;
    }

    if (this.riskValidator) {
      const riskError = this.riskValidator.validateOrder(cmd);
      if (riskError) {
        events.push({
          type: 'ORDER_REJECTED',
          seq,
          orderId: cmd.orderId,
          traderId: cmd.traderId,
          reason: riskError,
          timestamp: cmd.timestamp,
        });
        return events;
      }
    }

    const oppositeSide: Side = cmd.side === 'BUY' ? 'SELL' : 'BUY';

    if (cmd.orderType === 'POST_ONLY') {
      const bestOpposite =
        cmd.side === 'BUY' ? this.book.getBestAskPrice() : this.book.getBestBidPrice();
      const wouldCross =
        bestOpposite !== null &&
        (cmd.side === 'BUY' ? cmd.price >= bestOpposite : cmd.price <= bestOpposite);

      if (wouldCross) {
        events.push({
          type: 'ORDER_CANCELLED',
          seq,
          orderId: cmd.orderId,
          traderId: cmd.traderId,
          remainingQty: cmd.qty,
          reason: 'POST_ONLY_CROSS',
          timestamp: cmd.timestamp,
        });
        return events;
      }
    }

    if (cmd.orderType === 'FOK') {
      const available = this.book.getAvailableLiquidity(oppositeSide, cmd.price);
      if (available < cmd.qty) {
        events.push({
          type: 'ORDER_CANCELLED',
          seq,
          orderId: cmd.orderId,
          traderId: cmd.traderId,
          remainingQty: cmd.qty,
          reason: 'FOK_UNFILLED',
          timestamp: cmd.timestamp,
        });
        return events;
      }
    }

    events.push({
      type: 'ORDER_ACCEPTED',
      seq,
      orderId: cmd.orderId,
      traderId: cmd.traderId,
      side: cmd.side,
      orderType: cmd.orderType,
      price: cmd.price,
      qty: cmd.qty,
      timestamp: cmd.timestamp,
    });

    let remainingQty = cmd.qty;

    while (remainingQty > 0) {
      const bestLevel =
        cmd.side === 'BUY' ? this.book.getBestAskLevel() : this.book.getBestBidLevel();
      if (!bestLevel) break;

      if (cmd.orderType !== 'MARKET') {
        const priceMatches =
          cmd.side === 'BUY' ? bestLevel.price <= cmd.price : bestLevel.price >= cmd.price;
        if (!priceMatches) break;
      }

      const makerOrder = bestLevel.peek();
      if (!makerOrder) break;

      if (makerOrder.traderId === cmd.traderId) {
        this.book.removeOrder(makerOrder.orderId);
        events.push({
          type: 'ORDER_CANCELLED',
          seq,
          orderId: makerOrder.orderId,
          traderId: makerOrder.traderId,
          remainingQty: makerOrder.remainingQty,
          reason: 'USER_CANCEL',
          timestamp: cmd.timestamp,
        });
        continue;
      }

      const fillQty = Math.min(remainingQty, makerOrder.remainingQty);
      const tradePrice = makerOrder.price;
      this.tradeCounter += 1;

      this.book.consumeBestLevel(oppositeSide, fillQty);
      remainingQty -= fillQty;

      if (this.riskValidator) {
        this.riskValidator.onTrade(
          makerOrder.traderId,
          cmd.traderId,
          cmd.side,
          tradePrice,
          fillQty
        );
      }

      events.push({
        type: 'TRADE',
        seq,
        tradeId: `T-${seq}-${this.tradeCounter}`,
        price: tradePrice,
        qty: fillQty,
        makerOrderId: makerOrder.orderId,
        makerTraderId: makerOrder.traderId,
        takerOrderId: cmd.orderId,
        takerTraderId: cmd.traderId,
        takerSide: cmd.side,
        timestamp: cmd.timestamp,
      });
    }

    if (remainingQty > 0) {
      if (cmd.orderType === 'LIMIT' || cmd.orderType === 'POST_ONLY') {
        const resting: RestingOrder = {
          orderId: cmd.orderId,
          traderId: cmd.traderId,
          side: cmd.side,
          price: cmd.price,
          qty: cmd.qty,
          remainingQty,
          seq,
          timestamp: cmd.timestamp,
        };
        this.book.addOrder(resting);
      } else {
        events.push({
          type: 'ORDER_CANCELLED',
          seq,
          orderId: cmd.orderId,
          traderId: cmd.traderId,
          remainingQty,
          reason: 'IOC_REMAINDER',
          timestamp: cmd.timestamp,
        });
      }
    }

    return events;
  }

  private handleCancel(seq: number, cmd: CancelOrderCommand): EngineEvent[] {
    const existing = this.book.getOrder(cmd.orderId);
    if (!existing || existing.traderId !== cmd.traderId) {
      return [
        {
          type: 'ORDER_REJECTED',
          seq,
          orderId: cmd.orderId,
          traderId: cmd.traderId,
          reason: 'ORDER_NOT_FOUND',
          timestamp: cmd.timestamp,
        },
      ];
    }

    this.book.removeOrder(cmd.orderId);
    return [
      {
        type: 'ORDER_CANCELLED',
        seq,
        orderId: cmd.orderId,
        traderId: cmd.traderId,
        remainingQty: existing.remainingQty,
        reason: 'USER_CANCEL',
        timestamp: cmd.timestamp,
      },
    ];
  }

  private handleModify(seq: number, cmd: ModifyOrderCommand): EngineEvent[] {
    const existing = this.book.getOrder(cmd.orderId);
    if (!existing || existing.traderId !== cmd.traderId) {
      return [
        {
          type: 'ORDER_REJECTED',
          seq,
          orderId: cmd.orderId,
          traderId: cmd.traderId,
          reason: 'ORDER_NOT_FOUND',
          timestamp: cmd.timestamp,
        },
      ];
    }

    const targetPrice = cmd.newPrice ?? existing.price;
    const filledSoFar = existing.qty - existing.remainingQty;
    if (cmd.newQty <= filledSoFar) {
      return [
        {
          type: 'ORDER_REJECTED',
          seq,
          orderId: cmd.orderId,
          traderId: cmd.traderId,
          reason: 'NEW_QTY_BELOW_FILLED',
          timestamp: cmd.timestamp,
        },
      ];
    }

    if (this.riskValidator) {
      const riskError = this.riskValidator.validateModify(existing, targetPrice, cmd.newQty);
      if (riskError) {
        return [
          {
            type: 'ORDER_REJECTED',
            seq,
            orderId: cmd.orderId,
            traderId: cmd.traderId,
            reason: riskError,
            timestamp: cmd.timestamp,
          },
        ];
      }
    }

    const oldPrice = existing.price;
    const oldQty = existing.qty;
    const newRemaining = cmd.newQty - filledSoFar;
    const priceChanged = targetPrice !== oldPrice;
    const sizeIncreased = cmd.newQty > oldQty;

    if (priceChanged || sizeIncreased) {
      this.book.removeOrder(existing.orderId);
      const events: EngineEvent[] = [
        {
          type: 'ORDER_MODIFIED',
          seq,
          orderId: existing.orderId,
          traderId: existing.traderId,
          oldPrice,
          newPrice: targetPrice,
          oldQty,
          newQty: cmd.newQty,
          lostPriority: true,
          timestamp: cmd.timestamp,
        },
      ];

      const matchEvents = this.handlePlace(seq, {
        kind: 'PLACE',
        orderId: existing.orderId,
        traderId: existing.traderId,
        side: existing.side,
        orderType: 'LIMIT',
        price: targetPrice,
        qty: newRemaining,
        timestamp: cmd.timestamp,
      });

      return [...events, ...matchEvents.filter((e) => e.type !== 'ORDER_ACCEPTED')];
    }

    existing.qty = cmd.newQty;
    existing.remainingQty = newRemaining;
    const level =
      existing.side === 'BUY' ? this.book.getBestBidLevel() : this.book.getBestAskLevel();
    if (level && level.price === existing.price) {
      level.totalQty = level.orders.reduce((sum, o) => sum + o.remainingQty, 0);
    }

    return [
      {
        type: 'ORDER_MODIFIED',
        seq,
        orderId: existing.orderId,
        traderId: existing.traderId,
        oldPrice,
        newPrice: targetPrice,
        oldQty,
        newQty: cmd.newQty,
        lostPriority: false,
        timestamp: cmd.timestamp,
      },
    ];
  }
}
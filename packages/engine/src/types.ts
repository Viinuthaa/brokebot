import { z } from 'zod';

export const SideSchema = z.enum(['BUY', 'SELL']);
export type Side = z.infer<typeof SideSchema>;

export const OrderTypeSchema = z.enum([
  'LIMIT',
  'MARKET',
  'IOC',
  'FOK',
  'POST_ONLY',
]);
export type OrderType = z.infer<typeof OrderTypeSchema>;

export const PlaceOrderCommandSchema = z.object({
  kind: z.literal('PLACE'),
  orderId: z.string().min(1),
  traderId: z.string().min(1),
  side: SideSchema,
  orderType: OrderTypeSchema,
  price: z.number().int().nonnegative(),
  qty: z.number().int().positive(),
  timestamp: z.number().int().nonnegative(),
});
export type PlaceOrderCommand = z.infer<typeof PlaceOrderCommandSchema>;

export const CancelOrderCommandSchema = z.object({
  kind: z.literal('CANCEL'),
  orderId: z.string().min(1),
  traderId: z.string().min(1),
  timestamp: z.number().int().nonnegative(),
});
export type CancelOrderCommand = z.infer<typeof CancelOrderCommandSchema>;

export const ModifyOrderCommandSchema = z.object({
  kind: z.literal('MODIFY'),
  orderId: z.string().min(1),
  traderId: z.string().min(1),
  newPrice: z.number().int().positive().optional(),
  newQty: z.number().int().positive(),
  timestamp: z.number().int().nonnegative(),
});
export type ModifyOrderCommand = z.infer<typeof ModifyOrderCommandSchema>;

export const EngineCommandSchema = z.discriminatedUnion('kind', [
  PlaceOrderCommandSchema,
  CancelOrderCommandSchema,
  ModifyOrderCommandSchema,
]);
export type EngineCommand = z.infer<typeof EngineCommandSchema>;

export interface SequencedCommand {
  seq: number;
  command: EngineCommand;
}

export interface RestingOrder {
  orderId: string;
  traderId: string;
  side: Side;
  price: number;
  qty: number;
  remainingQty: number;
  seq: number;
  timestamp: number;
}

export type EngineEvent =
  | {
      type: 'ORDER_ACCEPTED';
      seq: number;
      orderId: string;
      traderId: string;
      side: Side;
      orderType: OrderType;
      price: number;
      qty: number;
      timestamp: number;
    }
  | {
      type: 'ORDER_REJECTED';
      seq: number;
      orderId: string;
      traderId: string;
      reason: string;
      timestamp: number;
    }
  | {
      type: 'TRADE';
      seq: number;
      tradeId: string;
      price: number;
      qty: number;
      makerOrderId: string;
      makerTraderId: string;
      takerOrderId: string;
      takerTraderId: string;
      takerSide: Side;
      timestamp: number;
    }
  | {
      type: 'ORDER_CANCELLED';
      seq: number;
      orderId: string;
      traderId: string;
      remainingQty: number;
      reason: 'USER_CANCEL' | 'IOC_REMAINDER' | 'FOK_UNFILLED' | 'POST_ONLY_CROSS';
      timestamp: number;
    }
  | {
      type: 'ORDER_MODIFIED';
      seq: number;
      orderId: string;
      traderId: string;
      oldPrice: number;
      newPrice: number;
      oldQty: number;
      newQty: number;
      lostPriority: boolean;
      timestamp: number;
    };

export interface BookLevel {
  price: number;
  totalQty: number;
  orderCount: number;
}

export interface BookSnapshot {
  seq: number;
  bids: BookLevel[];
  asks: BookLevel[];
  bestBid: number | null;
  bestAsk: number | null;
  midPrice: number | null;
  spread: number | null;
}


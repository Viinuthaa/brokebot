export type Side = 'BUY' | 'SELL';

export type OrderType = 'LIMIT' | 'MARKET' | 'IOC' | 'FOK' | 'POST_ONLY';

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

export interface AIThoughtLog {
  id: string;
  traderId: string;
  name: string;
  persona: string;
  timestamp: number;
  decision: {
    action: 'BUY' | 'SELL' | 'HOLD';
    orderType: 'LIMIT' | 'IOC' | 'POST_ONLY';
    priceOffsetTicks: number;
    qty: number;
    confidence: number;
    reasoning: string;
  };
  latencyMs: number;
  source: 'LLM_API' | 'LOCAL_FALLBACK';
}

export interface RecentTrade {
  price: number;
  qty: number;
  timestamp: number;
}

export interface EngineEvent {
  type: string;
  seq: number;
  price?: number;
  qty?: number;
  takerSide?: Side;
  reason?: string;
  timestamp: number;
}

export interface TickPayload {
  type: 'TICK';
  seq: number;
  tick: number;
  paused: boolean;
  fairValue: number;
  markPrice: number;
  book: BookSnapshot;
  events: EngineEvent[];
  aiThoughts: AIThoughtLog[];
  recentTrades: RecentTrade[];
  leaderboard: TraderStats[];
}

export interface ReplayPayload {
  type: 'REPLAY_STATE';
  seq: number;
  maxSeq: number;
  book: BookSnapshot;
  leaderboard: TraderStats[];
}

export type ShockScenario = 'FLASH_CRASH' | 'SHORT_SQUEEZE' | 'LIQUIDITY_VACUUM';
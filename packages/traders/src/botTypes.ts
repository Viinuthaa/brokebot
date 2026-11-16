import { BookSnapshot, EngineCommand, EngineEvent, TraderAccount } from '@lob/engine';

export interface MarketContext {
  timestamp: number;
  book: BookSnapshot;
  recentTrades: Array<{ price: number; qty: number; timestamp: number }>;
  account: TraderAccount;
  fairValue: number;
}

export interface BotAgent {
  readonly traderId: string;
  readonly name: string;
  readonly initialCash: number;
  tick(ctx: MarketContext): EngineCommand[];
  onEvents?(events: readonly EngineEvent[]): void;
}
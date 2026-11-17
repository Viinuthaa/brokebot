import { z } from 'zod';
import { EngineCommand } from '@lob/engine';
import { BotAgent, MarketContext } from './botTypes.js';
import { SeededRNG } from './rng.js';

export const LLMDecisionSchema = z.object({
  action: z.enum(['BUY', 'SELL', 'HOLD']),
  orderType: z.enum(['LIMIT', 'IOC', 'POST_ONLY']).default('LIMIT'),
  priceOffsetTicks: z.number().int().min(-50).max(50).default(0),
  qty: z.number().int().min(1).max(50).default(5),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(1).max(240),
});

export type LLMDecision = z.infer<typeof LLMDecisionSchema>;

export interface AIThoughtLog {
  id: string;
  traderId: string;
  name: string;
  persona: string;
  timestamp: number;
  decision: LLMDecision;
  latencyMs: number;
  source: 'LLM_API' | 'LOCAL_FALLBACK';
}

export interface LLMTraderConfig {
  traderId: string;
  name: string;
  persona: string;
  systemPrompt: string;
  initialCash: number;
  seed: number;
  decisionIntervalTicks?: number;
  apiUrl?: string;
  apiKey?: string;
  model?: string;
  onThought?: (thought: AIThoughtLog) => void;
}

export class LLMTraderAgent implements BotAgent {
  public readonly traderId: string;
  public readonly name: string;
  public readonly initialCash: number;

  private readonly persona: string;
  private readonly systemPrompt: string;
  private readonly decisionIntervalTicks: number;
  private readonly apiUrl: string;
  private readonly apiKey: string | undefined;
  private readonly model: string;
  private readonly onThought?: (thought: AIThoughtLog) => void;
  private readonly rng: SeededRNG;

  private ticksSinceLastCall = 0;
  private inFlight = false;
  private pendingCommands: EngineCommand[] = [];
  private orderCounter = 0;
  private thoughtCounter = 0;

  constructor(config: LLMTraderConfig) {
    this.traderId = config.traderId;
    this.name = config.name;
    this.persona = config.persona;
    this.systemPrompt = config.systemPrompt;
    this.initialCash = config.initialCash;
    this.decisionIntervalTicks = config.decisionIntervalTicks ?? 12;
    this.apiUrl = config.apiUrl ?? process.env.LLM_API_URL ?? 'https://api.openai.com/v1/chat/completions';
    this.apiKey = config.apiKey ?? process.env.LLM_API_KEY;
    this.model = config.model ?? process.env.LLM_MODEL ?? 'gpt-4o-mini';
    this.onThought = config.onThought;
    this.rng = new SeededRNG(config.seed);
  }

  tick(ctx: MarketContext): EngineCommand[] {
    const ready = this.pendingCommands;
    this.pendingCommands = [];

    this.ticksSinceLastCall += 1;
    if (!this.inFlight && this.ticksSinceLastCall >= this.decisionIntervalTicks) {
      this.ticksSinceLastCall = 0;
      void this.evaluateAsync(ctx);
    }

    return ready;
  }

  private async evaluateAsync(ctx: MarketContext): Promise<void> {
    this.inFlight = true;
    const startedAt = Date.now();

    try {
      const { decision, source } = this.apiKey
        ? await this.callRemoteLLM(ctx)
        : { decision: this.runLocalPersonaHeuristic(ctx), source: 'LOCAL_FALLBACK' as const };

      this.thoughtCounter += 1;
      this.onThought?.({
        id: `${this.traderId}-thought-${this.thoughtCounter}`,
        traderId: this.traderId,
        name: this.name,
        persona: this.persona,
        timestamp: Date.now(),
        decision,
        latencyMs: Date.now() - startedAt,
        source,
      });

      if (decision.action !== 'HOLD') {
        const refPrice = ctx.book.midPrice ?? ctx.fairValue;
        const targetPrice = Math.max(1, refPrice + decision.priceOffsetTicks);
        this.orderCounter += 1;

        this.pendingCommands.push({
          kind: 'PLACE',
          orderId: `${this.traderId}-ai-${this.orderCounter}`,
          traderId: this.traderId,
          side: decision.action,
          orderType: decision.orderType,
          price: targetPrice,
          qty: decision.qty,
          timestamp: Date.now(),
        });
      }
    } catch {
      const fallback = this.runLocalPersonaHeuristic(ctx);
      this.thoughtCounter += 1;
      this.onThought?.({
        id: `${this.traderId}-thought-${this.thoughtCounter}`,
        traderId: this.traderId,
        name: this.name,
        persona: this.persona,
        timestamp: Date.now(),
        decision: fallback,
        latencyMs: Date.now() - startedAt,
        source: 'LOCAL_FALLBACK',
      });
    } finally {
      this.inFlight = false;
    }
  }

  private async callRemoteLLM(
    ctx: MarketContext
  ): Promise<{ decision: LLMDecision; source: 'LLM_API' }> {
    const bidVol = ctx.book.bids.slice(0, 5).reduce((s, l) => s + l.totalQty, 0);
    const askVol = ctx.book.asks.slice(0, 5).reduce((s, l) => s + l.totalQty, 0);
    const imbalance = bidVol + askVol > 0 ? Number(((bidVol - askVol) / (bidVol + askVol)).toFixed(2)) : 0;
    const recentPrices = ctx.recentTrades.slice(-8).map((t) => t.price);

    const marketPrompt = JSON.stringify({
      bestBid: ctx.book.bestBid,
      bestAsk: ctx.book.bestAsk,
      midPrice: ctx.book.midPrice,
      spread: ctx.book.spread,
      top5Imbalance: imbalance,
      recentTradePrices: recentPrices,
      cash: ctx.account.cash,
      position: ctx.account.position,
      realizedPnL: ctx.account.realizedPnL,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);

    try {
      const res = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0.4,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: `${this.systemPrompt} Respond ONLY with JSON matching: {"action":"BUY"|"SELL"|"HOLD","orderType":"LIMIT"|"IOC"|"POST_ONLY","priceOffsetTicks":number,"qty":number,"confidence":number,"reasoning":string}`,
            },
            { role: 'user', content: marketPrompt },
          ],
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`LLM HTTP ${res.status}`);
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const rawContent = data.choices?.[0]?.message?.content ?? '{}';
      const parsed = LLMDecisionSchema.parse(JSON.parse(rawContent));
      return { decision: parsed, source: 'LLM_API' };
    } finally {
      clearTimeout(timeout);
    }
  }

  private runLocalPersonaHeuristic(ctx: MarketContext): LLMDecision {
    const bidVol = ctx.book.bids.slice(0, 5).reduce((s, l) => s + l.totalQty, 0);
    const askVol = ctx.book.asks.slice(0, 5).reduce((s, l) => s + l.totalQty, 0);
    const imbalance = bidVol + askVol > 0 ? (bidVol - askVol) / (bidVol + askVol) : 0;
    const mid = ctx.book.midPrice ?? ctx.fairValue;
    const lastPrice = ctx.recentTrades[ctx.recentTrades.length - 1]?.price ?? mid;
    const momentum = lastPrice - mid;

    if (this.persona === 'YOLO_DEGEN') {
      const side = momentum >= 0 ? 'BUY' : 'SELL';
      const qty = this.rng.nextInt(12, 30);
      return {
        action: side,
        orderType: 'IOC',
        priceOffsetTicks: side === 'BUY' ? 4 : -4,
        qty,
        confidence: 0.91,
        reasoning: `Tape moved ${momentum >= 0 ? '+' : ''}${momentum} ticks; aping ${qty} lots with IOC before the breakout leaves the station.`,
      };
    }

    if (this.persona === 'VALUE_CONTRARIAN') {
      if (Math.abs(imbalance) < 0.15) {
        return {
          action: 'HOLD',
          orderType: 'LIMIT',
          priceOffsetTicks: 0,
          qty: 5,
          confidence: 0.62,
          reasoning: `Order book imbalance (${imbalance.toFixed(2)}) is balanced; waiting for retail panic to fade.`,
        };
      }
      const side = imbalance > 0 ? 'SELL' : 'BUY';
      return {
        action: side,
        orderType: 'POST_ONLY',
        priceOffsetTicks: side === 'SELL' ? 3 : -3,
        qty: this.rng.nextInt(6, 14),
        confidence: 0.78,
        reasoning: `Book skew at ${imbalance.toFixed(2)}; providing passive ${side} liquidity into overcrowded flow.`,
      };
    }

    if (Math.abs(ctx.account.position) > 150) {
      const unwindSide = ctx.account.position > 0 ? 'SELL' : 'BUY';
      return {
        action: unwindSide,
        orderType: 'LIMIT',
        priceOffsetTicks: 0,
        qty: Math.min(20, Math.abs(ctx.account.position)),
        confidence: 0.85,
        reasoning: `Inventory at ${ctx.account.position} lots; trimming exposure back toward flat.`,
      };
    }

    const side = imbalance >= 0 ? 'BUY' : 'SELL';
    return {
      action: side,
      orderType: 'LIMIT',
      priceOffsetTicks: side === 'BUY' ? -1 : 1,
      qty: this.rng.nextInt(5, 12),
      confidence: 0.73,
      reasoning: `Top-5 depth ratio favors ${side} (${imbalance.toFixed(2)}); joining inside quote.`,
    };
  }
}
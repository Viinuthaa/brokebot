import { describe, expect, it } from 'vitest';
import { ExchangeSequencer } from '@lob/engine';
import {
  AIThoughtLog,
  LLMDecisionSchema,
  LLMTraderAgent,
  MarketMakerBot,
  NoiseTraderBot,
} from '../index.js';

describe('Automated & LLM Trading Agents', () => {
  it('validates LLM JSON decisions strictly with Zod', () => {
    const valid = LLMDecisionSchema.parse({
      action: 'BUY',
      orderType: 'LIMIT',
      priceOffsetTicks: -2,
      qty: 10,
      confidence: 0.85,
      reasoning: 'Bid imbalance building at top of book.',
    });
    expect(valid.action).toBe('BUY');

    expect(() =>
      LLMDecisionSchema.parse({
        action: 'ALL_IN',
        qty: 99999,
      })
    ).toThrow();
  });

  it('runs MarketMaker, Noise, and LLM fallback agents on the sequencer without errors', async () => {
    const ex = new ExchangeSequencer();
    const thoughts: AIThoughtLog[] = [];

    const mm = new MarketMakerBot('mm-1', 'MM', 10_000_000, 101);
    const noise = new NoiseTraderBot('noise-1', 'Noise', 2_000_000, 202);
    const ai = new LLMTraderAgent({
      traderId: 'ai-1',
      name: 'ChadGPT',
      persona: 'YOLO_DEGEN',
      systemPrompt: 'Test prompt',
      initialCash: 2_500_000,
      seed: 303,
      decisionIntervalTicks: 2,
      onThought: (t) => thoughts.push(t),
    });

    ex.registerTrader({ traderId: mm.traderId, name: mm.name, initialCash: mm.initialCash });
    ex.registerTrader({ traderId: noise.traderId, name: noise.name, initialCash: noise.initialCash });
    ex.registerTrader({ traderId: ai.traderId, name: ai.name, initialCash: ai.initialCash, isLLM: true });

    for (let tick = 1; tick <= 6; tick += 1) {
      for (const agent of [mm, noise, ai]) {
        const cmds = agent.tick({
          timestamp: tick * 250,
          book: ex.getBookSnapshot(20),
          recentTrades: [],
          account: ex.ledger.getAccount(agent.traderId)!,
          fairValue: 10000,
        });
        for (const cmd of cmds) {
          ex.submit(cmd);
        }
      }
      await new Promise((r) => setTimeout(r, 15));
    }

    expect(ex.getSequence()).toBeGreaterThan(0);
    expect(thoughts.length).toBeGreaterThan(0);
    expect(thoughts[0].source).toBe('LOCAL_FALLBACK');
  });
});
import { EngineCommand, ExchangeSequencer } from '@lob/engine';

export type ShockScenario = 'FLASH_CRASH' | 'SHORT_SQUEEZE' | 'LIQUIDITY_VACUUM';

export class ShockInjector {
  private orderCounter = 0;

  register(sequencer: ExchangeSequencer): void {
    sequencer.registerTrader({
      traderId: 'whale-chaos',
      name: 'Leviathan Whale (Shock)',
      initialCash: 50_000_000,
      isLLM: false,
    });
  }

  trigger(
    scenario: ShockScenario,
    sequencer: ExchangeSequencer,
    currentFairValue: number
  ): { newFairValue: number; commands: EngineCommand[] } {
    const timestamp = Date.now();
    const commands: EngineCommand[] = [];

    if (scenario === 'FLASH_CRASH') {
      const newFairValue = Math.max(500, Math.round(currentFairValue * 0.94));
      for (let i = 0; i < 4; i += 1) {
        this.orderCounter += 1;
        commands.push({
          kind: 'PLACE',
          orderId: `shock-crash-${this.orderCounter}`,
          traderId: 'whale-chaos',
          side: 'SELL',
          orderType: 'MARKET',
          price: 0,
          qty: 60,
          timestamp: timestamp + i,
        });
      }
      return { newFairValue, commands };
    }

    if (scenario === 'SHORT_SQUEEZE') {
      const newFairValue = Math.round(currentFairValue * 1.06);
      for (let i = 0; i < 4; i += 1) {
        this.orderCounter += 1;
        commands.push({
          kind: 'PLACE',
          orderId: `shock-squeeze-${this.orderCounter}`,
          traderId: 'whale-chaos',
          side: 'BUY',
          orderType: 'MARKET',
          price: 0,
          qty: 60,
          timestamp: timestamp + i,
        });
      }
      return { newFairValue, commands };
    }

    const snap = sequencer.getBookSnapshot(50);
    const sweepQty = snap.bids.reduce((sum, lvl) => sum + lvl.totalQty, 0);
    if (sweepQty > 0) {
      this.orderCounter += 1;
      commands.push({
        kind: 'PLACE',
        orderId: `shock-vac-${this.orderCounter}`,
        traderId: 'whale-chaos',
        side: 'SELL',
        orderType: 'MARKET',
        price: 0,
        qty: Math.min(450, Math.max(1, Math.floor(sweepQty * 0.8))),
        timestamp,
      });
    }
    return { newFairValue: Math.max(500, currentFairValue - 45), commands };
  }
}
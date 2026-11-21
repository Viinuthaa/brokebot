import { performance } from 'node:perf_hooks';
import { ExchangeSequencer } from './sequencer.js';
import { EngineCommand } from './types.js';

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[idx];
}

export function runBenchmark(totalOrders = 100_000): void {
  const ex = new ExchangeSequencer();

  for (let i = 0; i < 4; i += 1) {
    ex.registerTrader({
      traderId: `bench-trader-${i}`,
      name: `Bench ${i}`,
      initialCash: 100_000_000,
    });
  }

  let seed = 1337;
  const nextRand = () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const commands: EngineCommand[] = [];
  const activeIds: string[] = [];

  for (let i = 1; i <= totalOrders; i += 1) {
    const traderId = `bench-trader-${i % 4}`;
    const r = nextRand();

    if (r < 0.2 && activeIds.length > 0) {
      const pickIdx = Math.floor(nextRand() * activeIds.length);
      const orderId = activeIds[pickIdx];
      activeIds[pickIdx] = activeIds[activeIds.length - 1];
      activeIds.pop();

      commands.push({
        kind: 'CANCEL',
        orderId,
        traderId,
        timestamp: i,
      });
    } else if (r < 0.35) {
      const side = nextRand() < 0.5 ? 'BUY' : 'SELL';
      commands.push({
        kind: 'PLACE',
        orderId: `ord-${i}`,
        traderId,
        side,
        orderType: 'MARKET',
        price: 0,
        qty: 1 + Math.floor(nextRand() * 10),
        timestamp: i,
      });
    } else {
      const side = nextRand() < 0.5 ? 'BUY' : 'SELL';
      const offset = Math.floor((nextRand() - 0.5) * 40);
      const orderId = `ord-${i}`;
      activeIds.push(orderId);

      commands.push({
        kind: 'PLACE',
        orderId,
        traderId,
        side,
        orderType: 'LIMIT',
        price: 10000 + offset,
        qty: 1 + Math.floor(nextRand() * 15),
        timestamp: i,
      });
    }
  }

  for (let w = 0; w < 2000; w += 1) {
    ex.submit(commands[w]);
  }

  const latenciesUs: number[] = new Array(totalOrders);
  let totalTrades = 0;

  const startAll = performance.now();
  for (let i = 0; i < totalOrders; i += 1) {
    const t0 = performance.now();
    const res = ex.submit(commands[i]);
    const t1 = performance.now();
    latenciesUs[i] = (t1 - t0) * 1000;
    for (let e = 0; e < res.events.length; e += 1) {
      if (res.events[e].type === 'TRADE') totalTrades += 1;
    }
  }
  const elapsedMs = performance.now() - startAll;

  latenciesUs.sort((a, b) => a - b);
  const throughput = Math.round((totalOrders / elapsedMs) * 1000);

  console.log('\n--- BROKEBOT MATCHING ENGINE BENCHMARK ---');
  console.log(`Commands Processed : ${totalOrders.toLocaleString()}`);
  console.log(`Trades Executed    : ${totalTrades.toLocaleString()}`);
  console.log(`Total Elapsed      : ${elapsedMs.toFixed(2)} ms`);
  console.log(`Throughput         : ${throughput.toLocaleString()} orders/sec`);
  console.log(`p50 Latency        : ${percentile(latenciesUs, 0.5).toFixed(2)} us`);
  console.log(`p95 Latency        : ${percentile(latenciesUs, 0.95).toFixed(2)} us`);
  console.log(`p99 Latency        : ${percentile(latenciesUs, 0.99).toFixed(2)} us`);
  console.log(`Max Latency        : ${latenciesUs[latenciesUs.length - 1].toFixed(2)} us\n`);
}

runBenchmark();
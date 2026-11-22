# brokebot

A deterministic Limit Order Book (LOB) matching engine, multi-agent market simulator, and real-time editorial trading terminal built as a TypeScript monorepo.

---

## Overview

`brokebot` models an electronic exchange from the matching core up to the trader workstation. Every state transition in the exchange is processed sequentially as an immutable command, producing a deterministic event log that drives double-entry account ledgers, risk metrics, live WebSocket broadcasts, and exact point-in-time state reconstruction.

### Key Engineering Highlights

* **Deterministic Matching Core (`@lob/engine`):** Strict price-time priority (FIFO) matching across `LIMIT`, `MARKET`, `IOC`, `FOK`, and `POST_ONLY` order types using integer tick pricing (`1 tick = $0.01`) to eliminate floating-point drift.
* **Event-Sourced Time Travel:** Every fill, rest, cancel, and rejection emits a sequenced event (`#0` to `LIVE HEAD`), allowing the terminal to scrub backward and reconstruct exact historical order book depth and participant PnL at any sequence number.
* **Double-Entry Ledger & Risk Engine:** Tracks cash balances, net inventory, realized/unrealized PnL, rolling Sharpe ratio, and peak-to-trough maximum drawdown across all market participants in real time.
* **Multi-Agent Market Ecosystem (`@lob/traders`):** Simulates competing liquidity providers, mean-reversion and momentum strategies, retail order flow, and persona-driven AI agents (`Buffett-Bot`, `ChadGPT`, `Quant-9000`) with structured JSON decision schemas and deterministic heuristic fallbacks.
* **Chaos & Liquidity Shock Injector (`@lob/server`):** Real-time WebSocket gateway (`ws://localhost:8080`) featuring on-demand `FLASH_CRASH`, `SHORT_SQUEEZE`, and `LIQUIDITY_VACUUM` stress tests.
* **High-Contrast Editorial Terminal (`@lob/web`):** React + HTML5 Canvas workstation with an L2 depth ladder (click-to-fill pricing), execution tape vs. fair-value plotting, cumulative depth curves, live leaderboard, AI reasoning feed, and an event-log replay scrubber.

---

## Monorepo Architecture

```text
brokebot/
├── packages/
│   ├── engine/                
│   │   └── src/
│   │       ├── orderBook.ts    
│   │       ├── ledger.ts       
│   │       ├── sequencer.ts    
│   │       ├── benchmark.ts    
│   │       └── __tests__/      
│   └── traders/                
│       └── src/
│           ├── bots.ts         
│           ├── llmAgent.ts     
│           └── __tests__/      
└── apps/
    ├── server/                
    │   └── src/
    │       ├── index.ts        
    │       └── shockInjector.ts
    └── web/                    
        └── src/
            ├── hooks/          
            └── components/     
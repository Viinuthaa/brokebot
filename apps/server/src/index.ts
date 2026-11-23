import { createServer, Server as HttpServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import {
  EngineCommand,
  EngineEvent,
  ExchangeSequencer,
} from '@lob/engine';
import {
  AIThoughtLog,
  BotAgent,
  LLMTraderAgent,
  MarketMakerBot,
  MeanReversionBot,
  MomentumBot,
  NoiseTraderBot,
  SeededRNG,
} from '@lob/traders';
import { ShockInjector, ShockScenario } from './shockInjector.js';

const PORT = Number(process.env.PORT ?? 8080);
const TICK_MS = 250;

export class ExchangeServer {
  private sequencer = new ExchangeSequencer();
  private shockInjector = new ShockInjector();
  private bots: BotAgent[] = [];
  private recentTrades: Array<{ price: number; qty: number; timestamp: number }> = [];
  private aiThoughts: AIThoughtLog[] = [];
  private fairValue = 10000;
  private rng = new SeededRNG(42);
  private tickCount = 0;
  private isPaused = false;
  private timer: NodeJS.Timeout | null = null;
  private httpServer: HttpServer;
  private wss: WebSocketServer;

  constructor(port: number) {
    this.setupSimulation();
    this.httpServer = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', service: 'brokebot-exchange' }));
    });
    this.wss = new WebSocketServer({ server: this.httpServer });
    this.wss.on('connection', (ws) => this.handleConnection(ws));
    this.httpServer.listen(port);
    this.startLoop();
  }

  private setupSimulation(): void {
    this.sequencer = new ExchangeSequencer();
    this.shockInjector = new ShockInjector();
    this.recentTrades = [];
    this.aiThoughts = [];
    this.fairValue = 10000;
    this.tickCount = 0;

    this.sequencer.registerTrader({
      traderId: 'human-desk',
      name: 'You (Manual Desk)',
      initialCash: 5_000_000,
    });

    this.shockInjector.register(this.sequencer);

    const recordThought = (thought: AIThoughtLog) => {
      this.aiThoughts.unshift(thought);
      if (this.aiThoughts.length > 40) {
        this.aiThoughts.pop();
      }
    };

    const llmAgents = [
      new LLMTraderAgent({
        traderId: 'ai-yolo-gpt',
        name: 'ChadGPT (YOLO)',
        persona: 'YOLO_DEGEN',
        systemPrompt:
          'You are an overconfident momentum trader who chases breakouts aggressively and hates missing moves.',
        initialCash: 2_500_000,
        seed: 707,
        decisionIntervalTicks: 10,
        onThought: recordThought,
      }),
      new LLMTraderAgent({
        traderId: 'ai-claude-value',
        name: 'Buffett-Bot (Value)',
        persona: 'VALUE_CONTRARIAN',
        systemPrompt:
          'You are a patient contrarian value trader who fades order book imbalances using POST_ONLY limit orders.',
        initialCash: 4_000_000,
        seed: 808,
        decisionIntervalTicks: 14,
        onThought: recordThought,
      }),
      new LLMTraderAgent({
        traderId: 'ai-quant-risk',
        name: 'Quant-9000 (Risk)',
        persona: 'QUANT_RISK',
        systemPrompt:
          'You are a disciplined quantitative trader focused on micro-structure imbalance and strict inventory neutrality.',
        initialCash: 3_500_000,
        seed: 909,
        decisionIntervalTicks: 12,
        onThought: recordThought,
      }),
    ];

    const ruleBots: BotAgent[] = [
      new MarketMakerBot('mm-citadel', 'Citadel-Sim MM', 10_000_000, 101, 5, 20),
      new MarketMakerBot('mm-jump', 'Jump-Sim MM', 10_000_000, 202, 7, 15),
      new NoiseTraderBot('noise-retail-1', 'Retail Swarm A', 2_000_000, 303),
      new NoiseTraderBot('noise-retail-2', 'Retail Swarm B', 2_000_000, 404),
      new MomentumBot('momo-alpha', 'Momentum Falcon', 3_000_000, 505),
      new MeanReversionBot('reversion-zen', 'MeanRev Zen', 3_000_000, 606),
    ];

    for (const agent of llmAgents) {
      this.sequencer.registerTrader({
        traderId: agent.traderId,
        name: agent.name,
        initialCash: agent.initialCash,
        isLLM: true,
      });
    }

    for (const bot of ruleBots) {
      this.sequencer.registerTrader({
        traderId: bot.traderId,
        name: bot.name,
        initialCash: bot.initialCash,
        isLLM: false,
      });
    }

    this.bots = [...llmAgents, ...ruleBots];
  }

  private startLoop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      if (!this.isPaused) {
        this.stepTick();
      }
    }, TICK_MS);
  }

  private stepTick(): void {
    this.tickCount += 1;
    const timestamp = Date.now();

    const shock = Math.round(this.rng.nextGaussian(0, 2.5));
    this.fairValue = Math.max(500, this.fairValue + shock);

    const tickEvents: EngineEvent[] = [];

    for (const bot of this.bots) {
      const account = this.sequencer.ledger.getAccount(bot.traderId);
      if (!account) continue;

      const commands = bot.tick({
        timestamp,
        book: this.sequencer.getBookSnapshot(20),
        recentTrades: this.recentTrades.slice(-50),
        account,
        fairValue: this.fairValue,
      });

      for (const cmd of commands) {
        try {
          const { events } = this.sequencer.submit(cmd);
          this.recordTrades(events);
          tickEvents.push(...events);
        } catch {
        }
      }
    }

    for (const bot of this.bots) {
      bot.onEvents?.(tickEvents);
    }

    this.broadcastState(tickEvents);
  }

  private recordTrades(events: EngineEvent[]): void {
    for (const ev of events) {
      if (ev.type === 'TRADE') {
        this.recentTrades.push({
          price: ev.price,
          qty: ev.qty,
          timestamp: ev.timestamp,
        });
        if (this.recentTrades.length > 500) {
          this.recentTrades.shift();
        }
      }
    }
  }

  private handleConnection(ws: WebSocket): void {
    this.sendTo(ws, this.buildSnapshotPayload([]));

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.type === 'COMMAND') {
          const cmd: EngineCommand = {
            ...msg.command,
            timestamp: Date.now(),
          };
          const { events } = this.sequencer.submit(cmd);
          this.recordTrades(events);
          this.broadcastState(events);
        } else if (msg.type === 'SHOCK') {
          const scenario = (msg.scenario ?? 'FLASH_CRASH') as ShockScenario;
          const result = this.shockInjector.trigger(
            scenario,
            this.sequencer,
            this.fairValue
          );
          this.fairValue = result.newFairValue;
          const shockEvents: EngineEvent[] = [];
          for (const cmd of result.commands) {
            const { events } = this.sequencer.submit(cmd);
            this.recordTrades(events);
            shockEvents.push(...events);
          }
          this.broadcastState(shockEvents);
        } else if (msg.type === 'PAUSE') {
          this.isPaused = Boolean(msg.paused);
          this.broadcastState([]);
        } else if (msg.type === 'RESET') {
          this.setupSimulation();
          this.broadcastState([]);
        } else if (msg.type === 'REPLAY_QUERY') {
          const session = this.sequencer.exportSession();
          const targetSeq = Number(msg.seq ?? this.sequencer.getSequence());
          const replayed = ExchangeSequencer.replay(
            session.registrations,
            session.commands,
            targetSeq
          );
          const snap = replayed.getBookSnapshot(20);
          const mark = snap.midPrice ?? this.fairValue;
          this.sendTo(ws, {
            type: 'REPLAY_STATE',
            seq: targetSeq,
            maxSeq: this.sequencer.getSequence(),
            book: snap,
            leaderboard: replayed.ledger.getLeaderboard(mark),
          });
        }
      } catch (err) {
        this.sendTo(ws, {
          type: 'ERROR',
          message: err instanceof Error ? err.message : 'Invalid payload',
        });
      }
    });
  }

  private buildSnapshotPayload(events: EngineEvent[]) {
    const book = this.sequencer.getBookSnapshot(20);
    const markPrice =
      this.recentTrades[this.recentTrades.length - 1]?.price ??
      book.midPrice ??
      this.fairValue;

    return {
      type: 'TICK',
      seq: this.sequencer.getSequence(),
      tick: this.tickCount,
      paused: this.isPaused,
      fairValue: this.fairValue,
      markPrice,
      book,
      events,
      aiThoughts: this.aiThoughts.slice(0, 15),
      recentTrades: this.recentTrades.slice(-60),
      leaderboard: this.sequencer.ledger.getLeaderboard(markPrice),
    };
  }

  private broadcastState(events: EngineEvent[]): void {
    if (this.wss.clients.size === 0) return;
    const payload = JSON.stringify(this.buildSnapshotPayload(events));
    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  private sendTo(ws: WebSocket, data: unknown): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }
}

new ExchangeServer(PORT);
console.log(`brokebot exchange gateway listening on ws://localhost:${PORT}`);
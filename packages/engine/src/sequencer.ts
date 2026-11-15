import { AccountLedger } from './ledger.js';
import { MatchingEngine } from './matchingEngine.js';
import {
  BookSnapshot,
  EngineCommandSchema,
  EngineEvent,
  SequencedCommand,
} from './types.js';

export interface TraderRegistration {
  traderId: string;
  name: string;
  initialCash: number;
  isLLM?: boolean;
}

export class ExchangeSequencer {
  private seq = 0;
  private commandLog: SequencedCommand[] = [];
  private eventLog: EngineEvent[] = [];
  private registrations: TraderRegistration[] = [];

  public readonly ledger: AccountLedger;
  public readonly engine: MatchingEngine;

  constructor() {
    this.ledger = new AccountLedger();
    this.engine = new MatchingEngine(this.ledger);
  }

  registerTrader(reg: TraderRegistration): void {
    this.registrations.push(reg);
    this.ledger.registerTrader(reg.traderId, reg.name, reg.initialCash, reg.isLLM ?? false);
  }

  submit(rawCommand: unknown): { seq: number; events: EngineEvent[] } {
    const command = EngineCommandSchema.parse(rawCommand);
    this.seq += 1;
    const entry: SequencedCommand = { seq: this.seq, command };
    this.commandLog.push(entry);

    const events = this.engine.process(this.seq, command);
    this.eventLog.push(...events);
    return { seq: this.seq, events };
  }

  getSequence(): number {
    return this.seq;
  }

  getCommandLog(): readonly SequencedCommand[] {
    return this.commandLog;
  }

  getEventLog(): readonly EngineEvent[] {
    return this.eventLog;
  }

  getBookSnapshot(depth = 20): BookSnapshot {
    return this.engine.book.getSnapshot(this.seq, depth);
  }

  static replay(
    registrations: readonly TraderRegistration[],
    commands: readonly SequencedCommand[],
    upToSeq?: number
  ): ExchangeSequencer {
    const replayed = new ExchangeSequencer();
    for (const reg of registrations) {
      replayed.registerTrader(reg);
    }

    const limit = upToSeq ?? commands.length;
    for (const entry of commands) {
      if (entry.seq > limit) break;
      replayed.submit(entry.command);
    }
    return replayed;
  }

  exportSession(): {
    registrations: TraderRegistration[];
    commands: SequencedCommand[];
  } {
    return {
      registrations: [...this.registrations],
      commands: [...this.commandLog],
    };
  }
}
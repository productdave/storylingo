import type { RoundState } from "@shared/thinkGuess";

export type RoundLookup =
  | { kind: "found"; round: RoundState }
  | { kind: "missing" }
  | { kind: "expired" };

export interface RoundRepository {
  create(round: RoundState): Promise<void>;
  get(roundId: string): Promise<RoundLookup>;
  save(round: RoundState): Promise<void>;
  delete(roundId: string): Promise<void>;
  clear(): Promise<void>;
}

export class InMemoryRoundRepository implements RoundRepository {
  private readonly rounds = new Map<string, RoundState>();

  constructor(
    private readonly now: () => number = Date.now,
    private readonly maxRounds = 2_000,
  ) {
    if (!Number.isInteger(maxRounds) || maxRounds < 1) {
      throw new Error("maxRounds must be a positive integer");
    }
  }

  private pruneExpired(): void {
    const timestamp = this.now();
    for (const [roundId, round] of this.rounds) {
      if (round.expiresAt <= timestamp) this.rounds.delete(roundId);
    }
  }

  private makeRoomFor(roundId: string): void {
    this.pruneExpired();
    if (this.rounds.has(roundId)) return;
    while (this.rounds.size >= this.maxRounds) {
      const oldestRoundId = this.rounds.keys().next().value as
        | string
        | undefined;
      if (!oldestRoundId) break;
      this.rounds.delete(oldestRoundId);
    }
  }

  async create(round: RoundState): Promise<void> {
    this.makeRoomFor(round.id);
    this.rounds.set(round.id, structuredClone(round));
  }

  async get(roundId: string): Promise<RoundLookup> {
    const round = this.rounds.get(roundId);
    if (!round) return { kind: "missing" };
    if (round.expiresAt <= this.now()) {
      this.rounds.delete(roundId);
      return { kind: "expired" };
    }
    return { kind: "found", round: structuredClone(round) };
  }

  async save(round: RoundState): Promise<void> {
    this.makeRoomFor(round.id);
    this.rounds.set(round.id, structuredClone(round));
  }

  async delete(roundId: string): Promise<void> {
    this.rounds.delete(roundId);
  }

  async clear(): Promise<void> {
    this.rounds.clear();
  }
}

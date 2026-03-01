import { EventEmitter } from '@/utils/eventEmitter';
import { readStorage, writeStorage } from '@/utils/storage';

export interface ProfileStats {
  totalPlaytimeMs: number;
  sessions: number;
  bestScores: Record<string, number>;
  gamesPlayed: Record<string, number>;
  lastPlayedAt: number | null;
}

interface ProfileEvents {
  changed: ProfileStats;
}

const PROFILE_KEY = 'arcade.profile.v1';

const DEFAULT_PROFILE: ProfileStats = {
  totalPlaytimeMs: 0,
  sessions: 0,
  bestScores: {},
  gamesPlayed: {},
  lastPlayedAt: null,
};

export class ProfileManager {
  private profile: ProfileStats = readStorage(PROFILE_KEY, DEFAULT_PROFILE);
  readonly events = new EventEmitter<ProfileEvents>();

  get(): ProfileStats {
    return this.profile;
  }

  beginSession(gameId: string): number {
    this.profile = {
      ...this.profile,
      sessions: this.profile.sessions + 1,
      gamesPlayed: {
        ...this.profile.gamesPlayed,
        [gameId]: (this.profile.gamesPlayed[gameId] ?? 0) + 1,
      },
      lastPlayedAt: Date.now(),
    };
    this.persist();
    return Date.now();
  }

  endSession(startedAt: number): void {
    const elapsed = Math.max(0, Date.now() - startedAt);
    this.profile = {
      ...this.profile,
      totalPlaytimeMs: this.profile.totalPlaytimeMs + elapsed,
    };
    this.persist();
  }

  setBestScore(gameId: string, score: number): void {
    const prev = this.profile.bestScores[gameId] ?? 0;
    if (score <= prev) return;
    this.profile = {
      ...this.profile,
      bestScores: {
        ...this.profile.bestScores,
        [gameId]: score,
      },
    };
    this.persist();
  }

  private persist(): void {
    writeStorage(PROFILE_KEY, this.profile);
    this.events.emit('changed', this.profile);
  }
}

import { EventEmitter } from '@/utils/eventEmitter';
import { readStorage, writeStorage } from '@/utils/storage';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  unlockedAt: number | null;
}

interface AchievementEvents {
  unlocked: Achievement;
}

const ACHIEVEMENTS_KEY = 'arcade.achievements.v1';

const DEFAULT_ACHIEVEMENTS: Achievement[] = [
  { id: 'first_game', title: 'First Coin', description: 'Play your first game', unlockedAt: null },
  { id: 'ai_observer', title: 'Machine Spectator', description: 'Enable AI in any game', unlockedAt: null },
  { id: 'marathoner', title: 'Marathoner', description: 'Reach 60 minutes total playtime', unlockedAt: null },
  { id: 'combo_artist', title: 'Combo Artist', description: 'Trigger a combo in any score game', unlockedAt: null },
  { id: 'chess_mate', title: 'Checkmate Call', description: 'Finish a chess game', unlockedAt: null },
];

export class AchievementManager {
  private achievements: Achievement[] = readStorage(ACHIEVEMENTS_KEY, DEFAULT_ACHIEVEMENTS);
  readonly events = new EventEmitter<AchievementEvents>();

  list(): Achievement[] {
    return [...this.achievements].sort((a, b) => (b.unlockedAt ?? 0) - (a.unlockedAt ?? 0));
  }

  unlock(id: string): void {
    const current = this.achievements.find((item) => item.id === id);
    if (!current || current.unlockedAt) return;

    current.unlockedAt = Date.now();
    writeStorage(ACHIEVEMENTS_KEY, this.achievements);
    this.events.emit('unlocked', current);
  }

  isUnlocked(id: string): boolean {
    return Boolean(this.achievements.find((item) => item.id === id)?.unlockedAt);
  }
}

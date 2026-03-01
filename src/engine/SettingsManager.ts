import { EventEmitter } from '@/utils/eventEmitter';
import { readStorage, writeStorage } from '@/utils/storage';

export interface SettingsState {
  globalVolume: number;
  musicVolume: number;
  sfxVolume: number;
  theme: string;
  globalAIEnabled: boolean;
  perGameAI: Record<string, boolean>;
  debugOverlay: boolean;
}

interface SettingsEvents {
  changed: SettingsState;
}

const SETTINGS_KEY = 'arcade.settings.v1';

const DEFAULT_SETTINGS: SettingsState = {
  globalVolume: 0.7,
  musicVolume: 0.6,
  sfxVolume: 0.8,
  theme: 'modern-dark',
  globalAIEnabled: false,
  perGameAI: {},
  debugOverlay: false,
};

export class SettingsManager {
  private state: SettingsState = readStorage(SETTINGS_KEY, DEFAULT_SETTINGS);
  readonly events = new EventEmitter<SettingsEvents>();

  getState(): SettingsState {
    return this.state;
  }

  update(partial: Partial<SettingsState>): SettingsState {
    this.state = { ...this.state, ...partial };
    writeStorage(SETTINGS_KEY, this.state);
    this.events.emit('changed', this.state);
    return this.state;
  }

  setPerGameAI(gameId: string, enabled: boolean): void {
    this.state = {
      ...this.state,
      perGameAI: {
        ...this.state.perGameAI,
        [gameId]: enabled,
      },
    };
    writeStorage(SETTINGS_KEY, this.state);
    this.events.emit('changed', this.state);
  }

  isGameAIEnabled(gameId: string): boolean {
    const toggle = this.state.perGameAI[gameId];
    if (typeof toggle === 'boolean') {
      return toggle;
    }
    return this.state.globalAIEnabled;
  }
}

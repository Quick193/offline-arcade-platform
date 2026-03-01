import type { InputManager } from './InputManager';
import type { SettingsManager } from './SettingsManager';
import { clamp } from '@/utils/math';

export interface AIHandlers {
  tickAI: (deltaTime: number) => void;
  onPlayerOverride: () => void;
  onEvent?: (event: string, payload?: unknown) => void;
}

export interface AIRegisterOptions {
  hz?: number;
}

interface AIEntry {
  handlers: AIHandlers;
  options: Required<AIRegisterOptions>;
  running: boolean;
  timer: number | null;
  lastTick: number;
}

export class AIManager {
  private entries = new Map<string, AIEntry>();
  private currentGame: string | null = null;
  private globalEnabled = true;
  private perGameEnabled = new Map<string, boolean>();

  constructor(inputManager: InputManager, settings?: SettingsManager) {
    inputManager.events.on('player_input', () => {
      this.handlePlayerOverride();
    });

    if (settings) {
      const state = settings.getState();
      this.globalEnabled = state.globalAIEnabled;
      Object.entries(state.perGameAI).forEach(([gameId, enabled]) => {
        this.perGameEnabled.set(gameId, enabled);
      });

      settings.events.on('changed', (next) => {
        this.setGlobalEnabled(next.globalAIEnabled);
        Object.entries(next.perGameAI).forEach(([gameId, enabled]) => {
          this.setGameEnabled(gameId, enabled);
        });
      });
    }
  }

  register(gameId: string, handlers: AIHandlers, options: AIRegisterOptions = {}): void {
    const entry: AIEntry = {
      handlers,
      options: { hz: clamp(options.hz ?? 30, 20, 60) },
      running: false,
      timer: null,
      lastTick: performance.now(),
    };

    this.stop(gameId);
    this.entries.set(gameId, entry);
  }

  unregister(gameId: string): void {
    this.stop(gameId);
    this.entries.delete(gameId);
  }

  start(gameId: string): void {
    const entry = this.entries.get(gameId);
    if (!entry || entry.running) return;
    if (!this.globalEnabled) return;
    if (!this.isGameEnabled(gameId)) return;

    entry.running = true;
    entry.lastTick = performance.now();

    const intervalMs = Math.round(1000 / entry.options.hz);
    entry.timer = window.setInterval(() => {
      if (!entry.running) return;
      const now = performance.now();
      const deltaTime = Math.max(0, (now - entry.lastTick) / 1000);
      entry.lastTick = now;
      entry.handlers.tickAI(deltaTime);
    }, intervalMs);
  }

  stop(gameId: string): void {
    const entry = this.entries.get(gameId);
    if (!entry || !entry.running) return;

    if (entry.timer !== null) {
      clearInterval(entry.timer);
      entry.timer = null;
    }

    entry.running = false;
  }

  isRunning(gameId: string): boolean {
    return this.entries.get(gameId)?.running ?? false;
  }

  emitEvent(gameId: string, event: string, payload?: unknown): void {
    this.entries.get(gameId)?.handlers.onEvent?.(event, payload);
  }

  setCurrentGame(gameId: string | null): void {
    this.currentGame = gameId;
  }

  setGlobalEnabled(enabled: boolean): void {
    this.globalEnabled = enabled;
    if (!enabled) {
      this.entries.forEach((_, gameId) => this.stop(gameId));
    }
  }

  setGameEnabled(gameId: string, enabled: boolean): void {
    this.perGameEnabled.set(gameId, enabled);
    if (!enabled) {
      this.stop(gameId);
    }
  }

  isGameEnabled(gameId: string): boolean {
    return this.perGameEnabled.get(gameId) ?? this.globalEnabled;
  }

  private handlePlayerOverride(): void {
    if (!this.currentGame) return;
    const entry = this.entries.get(this.currentGame);
    if (!entry || !entry.running) return;

    entry.handlers.onPlayerOverride();
    this.stop(this.currentGame);
  }
}

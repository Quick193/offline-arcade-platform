import type { EventEmitter } from '@/utils/eventEmitter';
import type { InputManager } from './InputManager';
import type { ParticleEngine } from './ParticleEngine';
import type { ThemeManager } from './ThemeManager';
import type { AudioManager } from './AudioManager';
import type { SettingsManager } from './SettingsManager';
import type { AchievementManager } from './AchievementManager';
import type { ProfileManager } from './ProfileManager';
import type { AIManager } from './AIManager';

export type TransitionType = 'fade' | 'slide' | 'zoom';

export interface SceneTransition {
  type: TransitionType;
  duration: number;
}

export interface Scene {
  id: string;
  onEnter?: () => void;
  onExit?: () => void;
  update: (deltaTime: number) => void;
  render: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
  resize?: (width: number, height: number) => void;
}

export interface GameHandle {
  start(): void;
  stop(): void;
  startAI(): void;
  stopAI(): void;
  resize(): void;
}

export interface EngineEvents {
  game_started: { gameId: string };
  game_stopped: { gameId: string };
  achievement_unlocked: { id: string };
}

export interface EngineContext {
  input: InputManager;
  particles: ParticleEngine;
  theme: ThemeManager;
  audio: AudioManager;
  settings: SettingsManager;
  achievements: AchievementManager;
  profile: ProfileManager;
  ai: AIManager;
  eventBus: EventEmitter<EngineEvents>;
}

export class SceneManager {
  private current: Scene | null = null;
  private previous: Scene | null = null;
  private transition: SceneTransition = { type: 'fade', duration: 0.28 };
  private transitionTime = 1;
  private transitioning = false;

  setScene(scene: Scene, transition?: SceneTransition): void {
    this.previous = this.current;
    this.previous?.onExit?.();
    this.current = scene;
    this.current.onEnter?.();
    if (transition) {
      this.transition = transition;
    }
    this.transitioning = true;
    this.transitionTime = 0;
  }

  update(deltaTime: number): void {
    this.current?.update(deltaTime);
    if (!this.transitioning) return;
    this.transitionTime += deltaTime;
    if (this.transitionTime >= this.transition.duration) {
      this.transitionTime = this.transition.duration;
      this.transitioning = false;
      this.previous = null;
    }
  }

  render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    this.current?.render(ctx, width, height);

    if (!this.transitioning || !this.previous) return;

    const alpha = Math.min(1, this.transitionTime / this.transition.duration);
    ctx.save();

    if (this.transition.type === 'fade') {
      ctx.globalAlpha = 1 - alpha;
      this.previous.render(ctx, width, height);
    }

    if (this.transition.type === 'slide') {
      const shift = width * alpha;
      ctx.save();
      ctx.translate(-shift, 0);
      this.current?.render(ctx, width, height);
      ctx.restore();
      ctx.save();
      ctx.translate(width - shift, 0);
      this.previous.render(ctx, width, height);
      ctx.restore();
    }

    if (this.transition.type === 'zoom') {
      const scaleOld = Math.max(0.85, 1 - alpha * 0.15);
      const scaleNew = Math.min(1, 0.85 + alpha * 0.15);

      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.scale(scaleOld, scaleOld);
      ctx.translate(-width / 2, -height / 2);
      ctx.globalAlpha = 1 - alpha;
      this.previous.render(ctx, width, height);
      ctx.restore();

      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.scale(scaleNew, scaleNew);
      ctx.translate(-width / 2, -height / 2);
      ctx.globalAlpha = alpha;
      this.current?.render(ctx, width, height);
      ctx.restore();
    }

    ctx.restore();
  }

  resize(width: number, height: number): void {
    this.current?.resize?.(width, height);
    this.previous?.resize?.(width, height);
  }
}

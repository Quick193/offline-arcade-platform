import type { EngineContext, GameHandle } from '@/engine/Scene';

export type GameFactory = (canvas: HTMLCanvasElement, ctx: EngineContext) => GameHandle;

export interface BaseCanvasGame {
  start(): void;
  stop(): void;
  resize(): void;
  setAIEnabled(enabled: boolean): void;
}

import { GameLoop } from '@/engine/GameLoop';
import type { EngineContext, GameHandle } from '@/engine/Scene';
import { ResponsiveCanvas } from '@/engine/ResponsiveCanvas';

export interface CanvasGameLifecycle {
  id: string;
  update: (deltaTime: number) => void;
  render: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
  onStart?: () => void;
  onStop?: () => void;
  onResize?: (width: number, height: number) => void;
  startAI?: () => void;
  stopAI?: () => void;
  renderTextState?: () => unknown;
}

export function createCanvasGame(
  canvas: HTMLCanvasElement,
  engine: EngineContext,
  lifecycle: CanvasGameLifecycle,
): GameHandle {
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas 2D context is required');
  }

  const responsive = new ResponsiveCanvas(canvas, { maxWidth: 900, aspectRatio: 16 / 9 });
  let width = 900;
  let height = 506;

  const render = () => {
    context.clearRect(0, 0, width, height);
    lifecycle.render(context, width, height);
    engine.particles.render(context);
  };

  const loop = new GameLoop(
    (deltaTime) => {
      lifecycle.update(deltaTime);
      engine.particles.update(deltaTime);
    },
    () => render(),
  );

  window.advanceTime = (ms: number) => {
    loop.advance(ms);
    render();
  };

  window.render_game_to_text = () => {
    if (!lifecycle.renderTextState) {
      return JSON.stringify({ mode: 'running', gameId: lifecycle.id });
    }
    return JSON.stringify(lifecycle.renderTextState());
  };

  return {
    start() {
      lifecycle.onStart?.();
      responsive.start((nextW, nextH) => {
        width = nextW;
        height = nextH;
        lifecycle.onResize?.(nextW, nextH);
      });
      loop.start();
    },
    stop() {
      loop.stop();
      responsive.stop();
      lifecycle.onStop?.();
      lifecycle.stopAI?.();
      if (window.render_game_to_text) {
        delete window.render_game_to_text;
      }
      if (window.advanceTime) {
        delete window.advanceTime;
      }
    },
    startAI() {
      lifecycle.startAI?.();
    },
    stopAI() {
      lifecycle.stopAI?.();
    },
    resize() {
      lifecycle.onResize?.(width, height);
    },
  };
}

import { clamp } from '@/utils/math';

export type UpdateFn = (deltaTime: number) => void;
export type RenderFn = (alpha: number) => void;

export class GameLoop {
  private running = false;
  private raf = 0;
  private lastTime = 0;
  private accumulator = 0;
  private fixedStep = 1 / 60;

  constructor(
    private readonly update: UpdateFn,
    private readonly render?: RenderFn,
  ) {}

  setFixedStep(step: number): void {
    this.fixedStep = clamp(step, 1 / 240, 1 / 20);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();

    const tick = (time: number) => {
      if (!this.running) return;
      const dt = clamp((time - this.lastTime) / 1000, 0, 0.1);
      this.lastTime = time;
      this.accumulator += dt;

      while (this.accumulator >= this.fixedStep) {
        this.update(this.fixedStep);
        this.accumulator -= this.fixedStep;
      }

      this.render?.(this.accumulator / this.fixedStep);
      this.raf = requestAnimationFrame(tick);
    };

    this.raf = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  isRunning(): boolean {
    return this.running;
  }

  advance(ms: number): void {
    const safeMs = Math.max(0, ms);
    const steps = Math.max(1, Math.round(safeMs / (this.fixedStep * 1000)));
    for (let i = 0; i < steps; i += 1) {
      this.update(this.fixedStep);
    }
    this.render?.(0);
  }
}

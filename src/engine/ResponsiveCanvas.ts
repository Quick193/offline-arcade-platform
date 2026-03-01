export interface ResponsiveCanvasOptions {
  maxWidth?: number;
  aspectRatio?: number;
}

export class ResponsiveCanvas {
  private observer: ResizeObserver | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly options: ResponsiveCanvasOptions = {},
  ) {}

  start(onResize?: (width: number, height: number) => void): void {
    const maxWidth = this.options.maxWidth ?? 900;
    const aspectRatio = this.options.aspectRatio ?? 16 / 9;

    const resize = () => {
      const parent = this.canvas.parentElement;
      if (!parent) return;

      const width = Math.min(parent.clientWidth, maxWidth);
      const height = width / aspectRatio;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;
      this.canvas.width = Math.floor(width * dpr);
      this.canvas.height = Math.floor(height * dpr);

      const ctx = this.canvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.imageSmoothingEnabled = false;
      }

      onResize?.(width, height);
    };

    resize();
    this.observer = new ResizeObserver(resize);
    this.observer.observe(this.canvas.parentElement ?? document.body);
    window.addEventListener('resize', resize);
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
  }
}

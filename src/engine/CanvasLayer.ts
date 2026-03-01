export interface CanvasLayerHandle {
  id: string;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

export class CanvasLayer {
  private layers = new Map<string, CanvasLayerHandle>();

  constructor(private readonly container: HTMLElement) {
    this.container.style.position = 'relative';
  }

  createLayer(id: string, zIndex: number): CanvasLayerHandle {
    const existing = this.layers.get(id);
    if (existing) return existing;

    const canvas = document.createElement('canvas');
    canvas.dataset.layer = id;
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.zIndex = `${zIndex}`;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.width = this.container.clientWidth;
    canvas.height = this.container.clientHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error(`Failed to get 2D context for layer ${id}`);
    }

    const handle: CanvasLayerHandle = { id, canvas, ctx };
    this.layers.set(id, handle);
    this.container.appendChild(canvas);
    return handle;
  }

  getLayer(id: string): CanvasLayerHandle | undefined {
    return this.layers.get(id);
  }

  removeLayer(id: string): void {
    const layer = this.layers.get(id);
    if (!layer) return;
    layer.canvas.remove();
    this.layers.delete(id);
  }

  resize(width: number, height: number): void {
    this.layers.forEach((layer) => {
      layer.canvas.width = width;
      layer.canvas.height = height;
    });
  }

  clearAll(): void {
    this.layers.forEach((layer) => {
      layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
    });
  }

  destroy(): void {
    this.layers.forEach((layer) => layer.canvas.remove());
    this.layers.clear();
  }
}

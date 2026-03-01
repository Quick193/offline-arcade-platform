import type { Square } from './ChessEngine';

export interface Arrow {
  from: Square;
  to: Square;
  color: string;
}

export class ArrowSystem {
  private arrows: Arrow[] = [];
  private dragging: { from: Square; to: Square } | null = null;

  start(from: Square): void {
    this.dragging = { from, to: from };
  }

  update(to: Square): void {
    if (!this.dragging) return;
    this.dragging.to = to;
  }

  end(color = 'rgba(255,196,94,0.9)'): void {
    if (!this.dragging) return;
    const arrow: Arrow = { ...this.dragging, color };
    if (arrow.from.x !== arrow.to.x || arrow.from.y !== arrow.to.y) {
      this.arrows.push(arrow);
    }
    this.dragging = null;
  }

  clear(): void {
    this.arrows = [];
    this.dragging = null;
  }

  getArrows(): Arrow[] {
    return [...this.arrows, ...(this.dragging ? [{ ...this.dragging, color: 'rgba(255,230,160,0.7)' }] : [])];
  }
}

import type { ChessMove } from './MoveGenerator';

export class ReplaySystem {
  private moves: ChessMove[] = [];
  private cursor = 0;

  push(move: ChessMove): void {
    if (this.cursor < this.moves.length) {
      this.moves = this.moves.slice(0, this.cursor);
    }
    this.moves.push({ ...move });
    this.cursor = this.moves.length;
  }

  canUndo(): boolean {
    return this.cursor > 0;
  }

  canRedo(): boolean {
    return this.cursor < this.moves.length;
  }

  undo(): ChessMove | null {
    if (!this.canUndo()) return null;
    this.cursor -= 1;
    return this.moves[this.cursor] ?? null;
  }

  redo(): ChessMove | null {
    if (!this.canRedo()) return null;
    const move = this.moves[this.cursor];
    this.cursor += 1;
    return move ?? null;
  }

  list(): ChessMove[] {
    return this.moves.slice(0, this.cursor).map((move) => ({ ...move }));
  }

  reset(): void {
    this.moves = [];
    this.cursor = 0;
  }
}

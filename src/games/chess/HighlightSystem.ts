import type { ChessMove } from './MoveGenerator';
import type { Square } from './ChessEngine';

export class HighlightSystem {
  private selected: Square | null = null;
  private moves: ChessMove[] = [];

  select(square: Square | null, legalMoves: ChessMove[]): void {
    this.selected = square;
    if (!square) {
      this.moves = [];
      return;
    }
    this.moves = legalMoves.filter((move) => move.from.x === square.x && move.from.y === square.y);
  }

  clear(): void {
    this.selected = null;
    this.moves = [];
  }

  getSelected(): Square | null {
    return this.selected;
  }

  getTargets(): Square[] {
    return this.moves.map((move) => move.to);
  }

  findMove(to: Square): ChessMove | null {
    return this.moves.find((move) => move.to.x === to.x && move.to.y === to.y) ?? null;
  }
}

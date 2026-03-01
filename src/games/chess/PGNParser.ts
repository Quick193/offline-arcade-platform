import { squareToAlgebraic, type HistoryEntry } from './ChessEngine';
import type { ChessMove } from './MoveGenerator';

export function exportPGN(history: HistoryEntry[]): string {
  let out = '';
  history.forEach((entry, index) => {
    if (index % 2 === 0) {
      out += `${Math.floor(index / 2) + 1}. `;
    }
    out += `${entry.san} `;
  });
  return out.trim();
}

export function exportCoordinateLine(moves: ChessMove[]): string {
  return moves
    .map((move) => `${squareToAlgebraic(move.from)}${squareToAlgebraic(move.to)}${move.promotion ?? ''}`)
    .join(' ');
}

export function parseCoordinateLine(text: string): Array<{ from: string; to: string; promotion?: string }> {
  return text
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => ({
      from: token.slice(0, 2),
      to: token.slice(2, 4),
      promotion: token.length > 4 ? token[4] : undefined,
    }));
}

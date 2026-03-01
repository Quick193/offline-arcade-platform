import type { Piece, Square } from './ChessEngine';
import type { Arrow } from './ArrowSystem';

interface ChessBoardProps {
  board: Piece[][];
  selected: Square | null;
  targets: Square[];
  arrows: Arrow[];
}

const PIECE_SYMBOL: Record<string, string> = {
  K: '♔',
  Q: '♕',
  R: '♖',
  B: '♗',
  N: '♘',
  P: '♙',
  k: '♚',
  q: '♛',
  r: '♜',
  b: '♝',
  n: '♞',
  p: '♟',
};

export function ChessBoard({ board, selected, targets, arrows }: ChessBoardProps): JSX.Element {
  return (
    <div className="chess-board-dom">
      {board.map((row, y) =>
        row.map((piece, x) => {
          const dark = (x + y) % 2 === 1;
          const isSelected = selected && selected.x === x && selected.y === y;
          const isTarget = targets.some((target) => target.x === x && target.y === y);
          return (
            <div key={`${x}-${y}`} className={`chess-cell ${dark ? 'dark' : 'light'} ${isSelected ? 'selected' : ''} ${isTarget ? 'target' : ''}`}>
              {piece ? PIECE_SYMBOL[piece] : ''}
            </div>
          );
        }),
      )}
      <div className="arrow-count">Arrows: {arrows.length}</div>
    </div>
  );
}

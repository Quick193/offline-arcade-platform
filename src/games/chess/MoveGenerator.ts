import {
  applyMove,
  insideBoard,
  isKingInCheck,
  opposite,
  pieceColor,
  type ChessState,
  type Color,
  type Piece,
  type Square,
} from './ChessEngine';

export interface ChessMove {
  from: Square;
  to: Square;
  piece: Piece;
  capture: Piece;
  promotion?: 'q' | 'r' | 'b' | 'n';
  isCastle?: 'K' | 'Q';
  isEnPassant?: boolean;
  captureSquare?: Square;
}

const KNIGHT_OFFSETS = [
  [-2, -1],
  [-2, 1],
  [-1, -2],
  [-1, 2],
  [1, -2],
  [1, 2],
  [2, -1],
  [2, 1],
] as const;

const KING_OFFSETS = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
] as const;

function pushMove(moves: ChessMove[], from: Square, to: Square, piece: Piece, capture: Piece, promotion?: 'q' | 'r' | 'b' | 'n'): void {
  moves.push({ from, to, piece, capture, promotion });
}

function collectSliding(
  state: ChessState,
  moves: ChessMove[],
  from: Square,
  piece: Piece,
  color: Color,
  dirs: Array<[number, number]>,
): void {
  dirs.forEach(([dx, dy]) => {
    let x = from.x + dx;
    let y = from.y + dy;

    while (insideBoard(x, y)) {
      const target = state.board[y][x];
      if (!target) {
        pushMove(moves, from, { x, y }, piece, null);
      } else {
        if (pieceColor(target) !== color) {
          pushMove(moves, from, { x, y }, piece, target);
        }
        break;
      }
      x += dx;
      y += dy;
    }
  });
}

function squareUnderAttack(state: ChessState, square: Square, byColor: Color): boolean {
  const attacks = generateLegalMoves(state, byColor, true);
  return attacks.some((move) => move.to.x === square.x && move.to.y === square.y);
}

export function generateLegalMoves(state: ChessState, color: Color, forAttack = false): ChessMove[] {
  const pseudo: ChessMove[] = [];

  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const piece = state.board[y][x];
      if (!piece || pieceColor(piece) !== color) continue;

      const from = { x, y };
      const upper = piece.toUpperCase();

      if (upper === 'P') {
        const dir = color === 'w' ? -1 : 1;
        const startRank = color === 'w' ? 6 : 1;
        const promotionRank = color === 'w' ? 0 : 7;

        const oneForward = { x, y: y + dir };
        if (!forAttack && insideBoard(oneForward.x, oneForward.y) && !state.board[oneForward.y][oneForward.x]) {
          if (oneForward.y === promotionRank) {
            (['q', 'r', 'b', 'n'] as const).forEach((promotion) => {
              pushMove(pseudo, from, oneForward, piece, null, promotion);
            });
          } else {
            pushMove(pseudo, from, oneForward, piece, null);
          }

          const twoForward = { x, y: y + dir * 2 };
          if (y === startRank && !state.board[twoForward.y][twoForward.x]) {
            pushMove(pseudo, from, twoForward, piece, null);
          }
        }

        [-1, 1].forEach((dx) => {
          const tx = x + dx;
          const ty = y + dir;
          if (!insideBoard(tx, ty)) return;

          const target = state.board[ty][tx];
          if (target && pieceColor(target) !== color) {
            if (ty === promotionRank) {
              (['q', 'r', 'b', 'n'] as const).forEach((promotion) => {
                pushMove(pseudo, from, { x: tx, y: ty }, piece, target, promotion);
              });
            } else {
              pushMove(pseudo, from, { x: tx, y: ty }, piece, target);
            }
          }

          if (!forAttack && state.enPassant && state.enPassant.x === tx && state.enPassant.y === ty) {
            pseudo.push({
              from,
              to: { x: tx, y: ty },
              piece,
              capture: color === 'w' ? 'p' : 'P',
              isEnPassant: true,
              captureSquare: { x: tx, y },
            });
          }

          if (forAttack && !target) {
            pushMove(pseudo, from, { x: tx, y: ty }, piece, null);
          }
        });
      }

      if (upper === 'N') {
        KNIGHT_OFFSETS.forEach(([dx, dy]) => {
          const tx = x + dx;
          const ty = y + dy;
          if (!insideBoard(tx, ty)) return;
          const target = state.board[ty][tx];
          if (!target || pieceColor(target) !== color) {
            pushMove(pseudo, from, { x: tx, y: ty }, piece, target ?? null);
          }
        });
      }

      if (upper === 'B') {
        collectSliding(state, pseudo, from, piece, color, [
          [1, 1],
          [1, -1],
          [-1, 1],
          [-1, -1],
        ]);
      }

      if (upper === 'R') {
        collectSliding(state, pseudo, from, piece, color, [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]);
      }

      if (upper === 'Q') {
        collectSliding(state, pseudo, from, piece, color, [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
          [1, 1],
          [1, -1],
          [-1, 1],
          [-1, -1],
        ]);
      }

      if (upper === 'K') {
        KING_OFFSETS.forEach(([dx, dy]) => {
          const tx = x + dx;
          const ty = y + dy;
          if (!insideBoard(tx, ty)) return;
          const target = state.board[ty][tx];
          if (!target || pieceColor(target) !== color) {
            pushMove(pseudo, from, { x: tx, y: ty }, piece, target ?? null);
          }
        });

        if (!forAttack) {
          if (color === 'w' && y === 7 && x === 4) {
            if (
              state.castling.wk &&
              !state.board[7][5] &&
              !state.board[7][6] &&
              !squareUnderAttack(state, { x: 4, y: 7 }, 'b') &&
              !squareUnderAttack(state, { x: 5, y: 7 }, 'b') &&
              !squareUnderAttack(state, { x: 6, y: 7 }, 'b')
            ) {
              pseudo.push({ from, to: { x: 6, y: 7 }, piece, capture: null, isCastle: 'K' });
            }
            if (
              state.castling.wq &&
              !state.board[7][1] &&
              !state.board[7][2] &&
              !state.board[7][3] &&
              !squareUnderAttack(state, { x: 4, y: 7 }, 'b') &&
              !squareUnderAttack(state, { x: 3, y: 7 }, 'b') &&
              !squareUnderAttack(state, { x: 2, y: 7 }, 'b')
            ) {
              pseudo.push({ from, to: { x: 2, y: 7 }, piece, capture: null, isCastle: 'Q' });
            }
          }

          if (color === 'b' && y === 0 && x === 4) {
            if (
              state.castling.bk &&
              !state.board[0][5] &&
              !state.board[0][6] &&
              !squareUnderAttack(state, { x: 4, y: 0 }, 'w') &&
              !squareUnderAttack(state, { x: 5, y: 0 }, 'w') &&
              !squareUnderAttack(state, { x: 6, y: 0 }, 'w')
            ) {
              pseudo.push({ from, to: { x: 6, y: 0 }, piece, capture: null, isCastle: 'K' });
            }
            if (
              state.castling.bq &&
              !state.board[0][1] &&
              !state.board[0][2] &&
              !state.board[0][3] &&
              !squareUnderAttack(state, { x: 4, y: 0 }, 'w') &&
              !squareUnderAttack(state, { x: 3, y: 0 }, 'w') &&
              !squareUnderAttack(state, { x: 2, y: 0 }, 'w')
            ) {
              pseudo.push({ from, to: { x: 2, y: 0 }, piece, capture: null, isCastle: 'Q' });
            }
          }
        }
      }
    }
  }

  if (forAttack) return pseudo;

  return pseudo.filter((move) => {
    const next = applyMove(state, move);
    return !isKingInCheck(next, opposite(next.turn));
  });
}

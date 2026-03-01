import { generateLegalMoves, type ChessMove } from './MoveGenerator';

export type Color = 'w' | 'b';
export type Piece = 'P' | 'N' | 'B' | 'R' | 'Q' | 'K' | 'p' | 'n' | 'b' | 'r' | 'q' | 'k' | null;

export interface Square {
  x: number;
  y: number;
}

export interface CastlingRights {
  wk: boolean;
  wq: boolean;
  bk: boolean;
  bq: boolean;
}

export interface ChessState {
  board: Piece[][];
  turn: Color;
  castling: CastlingRights;
  enPassant: Square | null;
  halfmove: number;
  fullmove: number;
}

export interface HistoryEntry {
  state: ChessState;
  move: ChessMove;
  san: string;
}

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const FILES = 'abcdefgh';

export function squareToAlgebraic(square: Square): string {
  return `${FILES[square.x]}${8 - square.y}`;
}

export function algebraicToSquare(value: string): Square {
  const file = value[0]?.toLowerCase() ?? 'a';
  const rank = Number(value[1] ?? '1');
  return {
    x: Math.max(0, Math.min(7, FILES.indexOf(file))),
    y: Math.max(0, Math.min(7, 8 - rank)),
  };
}

export function cloneState(state: ChessState): ChessState {
  return {
    board: state.board.map((row) => [...row]),
    turn: state.turn,
    castling: { ...state.castling },
    enPassant: state.enPassant ? { ...state.enPassant } : null,
    halfmove: state.halfmove,
    fullmove: state.fullmove,
  };
}

function isWhite(piece: Piece): boolean {
  return Boolean(piece && piece === piece.toUpperCase());
}

function toSAN(move: ChessMove, stateBefore: ChessState, stateAfter: ChessState, legalMovesAfter: ChessMove[]): string {
  if (move.isCastle === 'K') return 'O-O';
  if (move.isCastle === 'Q') return 'O-O-O';

  const piece = move.piece?.toUpperCase() ?? 'P';
  const capture = move.capture ? 'x' : '';
  const to = squareToAlgebraic(move.to);

  let prefix = piece === 'P' ? '' : piece;
  if (piece === 'P' && capture) {
    prefix = FILES[move.from.x];
  }

  let suffix = '';
  if (move.promotion) suffix += `=${move.promotion.toUpperCase()}`;

  if (!legalMovesAfter.length) {
    const opponentInCheck = isKingInCheck(stateAfter, stateAfter.turn);
    suffix += opponentInCheck ? '#' : '';
  } else if (isKingInCheck(stateAfter, stateAfter.turn)) {
    suffix += '+';
  }

  return `${prefix}${capture}${to}${suffix}`;
}

export function pieceColor(piece: Piece): Color | null {
  if (!piece) return null;
  return isWhite(piece) ? 'w' : 'b';
}

export function opposite(color: Color): Color {
  return color === 'w' ? 'b' : 'w';
}

export function insideBoard(x: number, y: number): boolean {
  return x >= 0 && x < 8 && y >= 0 && y < 8;
}

export function findKing(state: ChessState, color: Color): Square | null {
  const target = color === 'w' ? 'K' : 'k';
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      if (state.board[y][x] === target) return { x, y };
    }
  }
  return null;
}

export function applyMove(state: ChessState, move: ChessMove): ChessState {
  const next = cloneState(state);
  const piece = next.board[move.from.y][move.from.x];
  next.board[move.from.y][move.from.x] = null;

  if (move.isEnPassant && move.captureSquare) {
    next.board[move.captureSquare.y][move.captureSquare.x] = null;
  }

  if (move.isCastle) {
    if (move.isCastle === 'K') {
      const row = piece === 'K' ? 7 : 0;
      next.board[row][6] = piece;
      next.board[row][5] = next.board[row][7];
      next.board[row][7] = null;
    } else {
      const row = piece === 'K' ? 7 : 0;
      next.board[row][2] = piece;
      next.board[row][3] = next.board[row][0];
      next.board[row][0] = null;
    }
  } else {
    const promoted = move.promotion
      ? (piece && piece === piece.toUpperCase() ? move.promotion.toUpperCase() : move.promotion.toLowerCase())
      : piece;
    next.board[move.to.y][move.to.x] = promoted as Piece;
  }

  const movedPiece = piece?.toUpperCase();
  if (movedPiece === 'K') {
    if (state.turn === 'w') {
      next.castling.wk = false;
      next.castling.wq = false;
    } else {
      next.castling.bk = false;
      next.castling.bq = false;
    }
  }

  if (movedPiece === 'R') {
    if (move.from.x === 0 && move.from.y === 7) next.castling.wq = false;
    if (move.from.x === 7 && move.from.y === 7) next.castling.wk = false;
    if (move.from.x === 0 && move.from.y === 0) next.castling.bq = false;
    if (move.from.x === 7 && move.from.y === 0) next.castling.bk = false;
  }

  if (move.capture && move.to.x === 0 && move.to.y === 7) next.castling.wq = false;
  if (move.capture && move.to.x === 7 && move.to.y === 7) next.castling.wk = false;
  if (move.capture && move.to.x === 0 && move.to.y === 0) next.castling.bq = false;
  if (move.capture && move.to.x === 7 && move.to.y === 0) next.castling.bk = false;

  if (piece?.toUpperCase() === 'P' && Math.abs(move.to.y - move.from.y) === 2) {
    next.enPassant = { x: move.from.x, y: (move.from.y + move.to.y) / 2 };
  } else {
    next.enPassant = null;
  }

  next.halfmove = piece?.toUpperCase() === 'P' || move.capture ? 0 : next.halfmove + 1;
  if (state.turn === 'b') next.fullmove += 1;
  next.turn = opposite(state.turn);

  return next;
}

export function isKingInCheck(state: ChessState, color: Color): boolean {
  const king = findKing(state, color);
  if (!king) return true;
  const enemyMoves = generateLegalMoves(state, opposite(color), true);
  return enemyMoves.some((move) => move.to.x === king.x && move.to.y === king.y);
}

export class ChessEngine {
  private state: ChessState;
  private history: HistoryEntry[] = [];
  private future: HistoryEntry[] = [];

  constructor(fen = START_FEN) {
    this.state = this.loadFenInternal(fen);
  }

  clone(): ChessEngine {
    const engine = new ChessEngine(this.getFEN());
    engine.history = this.history.map((entry) => ({ ...entry, state: cloneState(entry.state), move: { ...entry.move } }));
    engine.future = this.future.map((entry) => ({ ...entry, state: cloneState(entry.state), move: { ...entry.move } }));
    return engine;
  }

  reset(): void {
    this.state = this.loadFenInternal(START_FEN);
    this.history = [];
    this.future = [];
  }

  getState(): ChessState {
    return cloneState(this.state);
  }

  getBoard(): Piece[][] {
    return this.state.board.map((row) => [...row]);
  }

  getTurn(): Color {
    return this.state.turn;
  }

  getHistory(): HistoryEntry[] {
    return this.history.map((entry) => ({ ...entry, state: cloneState(entry.state), move: { ...entry.move } }));
  }

  loadFEN(fen: string): void {
    this.state = this.loadFenInternal(fen);
    this.history = [];
    this.future = [];
  }

  getFEN(): string {
    const rows = this.state.board.map((row) => {
      let text = '';
      let empty = 0;
      row.forEach((piece) => {
        if (!piece) {
          empty += 1;
          return;
        }
        if (empty > 0) {
          text += String(empty);
          empty = 0;
        }
        text += piece;
      });
      if (empty > 0) text += String(empty);
      return text;
    });

    const castling =
      `${this.state.castling.wk ? 'K' : ''}${this.state.castling.wq ? 'Q' : ''}${this.state.castling.bk ? 'k' : ''}${this.state.castling.bq ? 'q' : ''}` || '-';
    const enPassant = this.state.enPassant ? squareToAlgebraic(this.state.enPassant) : '-';

    return `${rows.join('/')} ${this.state.turn} ${castling} ${enPassant} ${this.state.halfmove} ${this.state.fullmove}`;
  }

  generateLegalMoves(color: Color = this.state.turn): ChessMove[] {
    return generateLegalMoves(this.state, color, false);
  }

  makeMove(move: ChessMove): boolean {
    const legal = this.generateLegalMoves(this.state.turn);
    const found = legal.find((candidate) =>
      candidate.from.x === move.from.x &&
      candidate.from.y === move.from.y &&
      candidate.to.x === move.to.x &&
      candidate.to.y === move.to.y &&
      (candidate.promotion ?? null) === (move.promotion ?? null),
    );

    if (!found) return false;

    const previous = cloneState(this.state);
    const next = applyMove(this.state, found);
    const legalAfter = generateLegalMoves(next, next.turn, false);
    const san = toSAN(found, previous, next, legalAfter);

    this.history.push({ state: previous, move: found, san });
    this.future = [];
    this.state = next;

    return true;
  }

  undo(): boolean {
    const previous = this.history.pop();
    if (!previous) return false;

    this.future.push({ state: cloneState(this.state), move: previous.move, san: previous.san });
    this.state = cloneState(previous.state);
    return true;
  }

  redo(): boolean {
    const next = this.future.pop();
    if (!next) return false;
    this.history.push({ state: cloneState(this.state), move: next.move, san: next.san });
    this.state = cloneState(next.state);
    return true;
  }

  isCheck(color: Color = this.state.turn): boolean {
    return isKingInCheck(this.state, color);
  }

  isCheckmate(color: Color = this.state.turn): boolean {
    return this.isCheck(color) && this.generateLegalMoves(color).length === 0;
  }

  isStalemate(color: Color = this.state.turn): boolean {
    return !this.isCheck(color) && this.generateLegalMoves(color).length === 0;
  }

  private loadFenInternal(fen: string): ChessState {
    const [boardPart, turnPart = 'w', castlingPart = 'KQkq', enPassantPart = '-', half = '0', full = '1'] = fen.trim().split(/\s+/);
    const rows = boardPart.split('/');

    const board: Piece[][] = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => null));

    rows.forEach((rowText, rowIndex) => {
      let file = 0;
      rowText.split('').forEach((char) => {
        if (/\d/.test(char)) {
          file += Number(char);
          return;
        }
        board[rowIndex][file] = char as Piece;
        file += 1;
      });
    });

    const castling: CastlingRights = {
      wk: castlingPart.includes('K'),
      wq: castlingPart.includes('Q'),
      bk: castlingPart.includes('k'),
      bq: castlingPart.includes('q'),
    };

    return {
      board,
      turn: turnPart === 'b' ? 'b' : 'w',
      castling,
      enPassant: enPassantPart === '-' ? null : algebraicToSquare(enPassantPart),
      halfmove: Number(half),
      fullmove: Number(full),
    };
  }
}

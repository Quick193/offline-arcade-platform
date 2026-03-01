import { applyMove, findKing, isKingInCheck, opposite, pieceColor, squareToAlgebraic, type ChessState, type Color, type Piece } from './ChessEngine';
import { generateLegalMoves, type ChessMove } from './MoveGenerator';

interface SearchResult {
  move: ChessMove | null;
  score: number;
  depth: number;
}

const PIECE_VALUES: Record<string, number> = {
  P: 100,
  N: 320,
  B: 330,
  R: 500,
  Q: 900,
  K: 0,
};

const PAWN_PST = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [6, 6, 14, 25, 25, 14, 6, 6],
  [0, 0, 0, 20, 20, 0, 0, 0],
  [4, -4, -8, 0, 0, -8, -4, 4],
  [4, 8, 8, -20, -20, 8, 8, 4],
  [0, 0, 0, 0, 0, 0, 0, 0],
];

const KNIGHT_PST = [
  [-50, -40, -30, -30, -30, -30, -40, -50],
  [-40, -20, 0, 0, 0, 0, -20, -40],
  [-30, 0, 10, 15, 15, 10, 0, -30],
  [-30, 5, 15, 20, 20, 15, 5, -30],
  [-30, 0, 15, 20, 20, 15, 0, -30],
  [-30, 5, 10, 15, 15, 10, 5, -30],
  [-40, -20, 0, 5, 5, 0, -20, -40],
  [-50, -40, -30, -30, -30, -30, -40, -50],
];

const BISHOP_PST = [
  [-20, -10, -10, -10, -10, -10, -10, -20],
  [-10, 5, 0, 0, 0, 0, 5, -10],
  [-10, 10, 10, 10, 10, 10, 10, -10],
  [-10, 0, 10, 10, 10, 10, 0, -10],
  [-10, 5, 5, 10, 10, 5, 5, -10],
  [-10, 0, 5, 10, 10, 5, 0, -10],
  [-10, 0, 0, 0, 0, 0, 0, -10],
  [-20, -10, -10, -10, -10, -10, -10, -20],
];

const ROOK_PST = [
  [0, 0, 5, 10, 10, 5, 0, 0],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [5, 10, 10, 10, 10, 10, 10, 5],
  [0, 0, 0, 0, 0, 0, 0, 0],
];

const QUEEN_PST = [
  [-20, -10, -10, -5, -5, -10, -10, -20],
  [-10, 0, 0, 0, 0, 0, 0, -10],
  [-10, 0, 5, 5, 5, 5, 0, -10],
  [-5, 0, 5, 5, 5, 5, 0, -5],
  [0, 0, 5, 5, 5, 5, 0, -5],
  [-10, 5, 5, 5, 5, 5, 0, -10],
  [-10, 0, 5, 0, 0, 0, 0, -10],
  [-20, -10, -10, -5, -5, -10, -10, -20],
];

const KING_PST = [
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-20, -30, -30, -40, -40, -30, -30, -20],
  [-10, -20, -20, -20, -20, -20, -20, -10],
  [20, 20, 0, 0, 0, 0, 20, 20],
  [20, 30, 10, 0, 0, 10, 30, 20],
];

const PST_MAP: Record<string, number[][]> = {
  P: PAWN_PST,
  N: KNIGHT_PST,
  B: BISHOP_PST,
  R: ROOK_PST,
  Q: QUEEN_PST,
  K: KING_PST,
};

const OPENING_BOOK: Record<string, string[]> = {
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w': ['e2e4', 'd2d4', 'c2c4', 'g1f3'],
};

function moveKey(move: ChessMove): string {
  const promotion = move.promotion ? move.promotion : '';
  return `${squareToAlgebraic(move.from)}${squareToAlgebraic(move.to)}${promotion}`;
}

function parseBookMove(input: string, legalMoves: ChessMove[]): ChessMove | null {
  const from = input.slice(0, 2);
  const to = input.slice(2, 4);
  const promotion = input.slice(4, 5);

  return (
    legalMoves.find((move) => {
      const key = `${squareToAlgebraic(move.from)}${squareToAlgebraic(move.to)}${move.promotion ?? ''}`;
      return key === `${from}${to}${promotion}`;
    }) ?? null
  );
}

export class MinimaxAI {
  private killerMoves = new Map<number, string[]>();
  private historyHeuristic = new Map<string, number>();

  search(state: ChessState, color: Color, maxDepth = 4, maxTimeMs = 800): SearchResult {
    const start = performance.now();
    const legalMoves = generateLegalMoves(state, color, false);
    if (!legalMoves.length) {
      if (isKingInCheck(state, color)) return { move: null, score: -99999, depth: 0 };
      return { move: null, score: 0, depth: 0 };
    }

    const fenPrefix = this.fenPrefix(state);
    const opening = OPENING_BOOK[fenPrefix];
    if (opening?.length) {
      for (const entry of opening) {
        const move = parseBookMove(entry, legalMoves);
        if (move) return { move, score: 0, depth: 0 };
      }
    }

    let best: SearchResult = { move: legalMoves[0], score: -Infinity, depth: 1 };

    for (let depth = 1; depth <= maxDepth; depth += 1) {
      const elapsed = performance.now() - start;
      if (elapsed >= maxTimeMs) break;

      const result = this.alphaBeta(state, depth, -Infinity, Infinity, color, color, start, maxTimeMs, 0);
      if (result.move) {
        best = { move: result.move, score: result.score, depth };
      }
    }

    return best;
  }

  private alphaBeta(
    state: ChessState,
    depth: number,
    alpha: number,
    beta: number,
    toMove: Color,
    maximizingFor: Color,
    start: number,
    maxTimeMs: number,
    ply: number,
  ): SearchResult {
    if (performance.now() - start >= maxTimeMs) {
      return { move: null, score: this.evaluate(state, maximizingFor), depth };
    }

    const legalMoves = generateLegalMoves(state, toMove, false);

    if (!legalMoves.length) {
      if (isKingInCheck(state, toMove)) {
        const mateScore = -90000 + ply;
        return { move: null, score: toMove === maximizingFor ? mateScore : -mateScore, depth };
      }
      return { move: null, score: 0, depth };
    }

    if (depth <= 0) {
      return { move: null, score: this.quiescence(state, alpha, beta, maximizingFor, toMove, start, maxTimeMs), depth };
    }

    const ordered = this.orderMoves(legalMoves, ply);

    let bestMove: ChessMove | null = ordered[0];

    if (toMove === maximizingFor) {
      let value = -Infinity;
      for (const move of ordered) {
        const next = applyMove(state, move);
        const result = this.alphaBeta(next, depth - 1, alpha, beta, opposite(toMove), maximizingFor, start, maxTimeMs, ply + 1).score;

        if (result > value) {
          value = result;
          bestMove = move;
        }

        alpha = Math.max(alpha, value);
        if (alpha >= beta) {
          this.pushKiller(move, ply);
          this.bumpHistory(move, depth);
          break;
        }
      }
      return { move: bestMove, score: value, depth };
    }

    let value = Infinity;
    for (const move of ordered) {
      const next = applyMove(state, move);
      const result = this.alphaBeta(next, depth - 1, alpha, beta, opposite(toMove), maximizingFor, start, maxTimeMs, ply + 1).score;

      if (result < value) {
        value = result;
        bestMove = move;
      }

      beta = Math.min(beta, value);
      if (alpha >= beta) {
        this.pushKiller(move, ply);
        this.bumpHistory(move, depth);
        break;
      }
    }

    return { move: bestMove, score: value, depth };
  }

  private quiescence(
    state: ChessState,
    alpha: number,
    beta: number,
    maximizingFor: Color,
    toMove: Color,
    start: number,
    maxTimeMs: number,
  ): number {
    if (performance.now() - start >= maxTimeMs) {
      return this.evaluate(state, maximizingFor);
    }

    let standPat = this.evaluate(state, maximizingFor);

    if (toMove === maximizingFor) {
      if (standPat >= beta) return beta;
      alpha = Math.max(alpha, standPat);
    } else {
      if (standPat <= alpha) return alpha;
      beta = Math.min(beta, standPat);
    }

    const captures = generateLegalMoves(state, toMove, false).filter((move) => Boolean(move.capture));
    const ordered = this.orderMoves(captures, 0);

    for (const move of ordered) {
      const next = applyMove(state, move);
      const score = this.quiescence(next, alpha, beta, maximizingFor, opposite(toMove), start, maxTimeMs);

      if (toMove === maximizingFor) {
        if (score > standPat) standPat = score;
        alpha = Math.max(alpha, standPat);
      } else {
        if (score < standPat) standPat = score;
        beta = Math.min(beta, standPat);
      }

      if (alpha >= beta) break;
    }

    return standPat;
  }

  private evaluate(state: ChessState, perspective: Color): number {
    const materialWeight = 1;
    const mobilityWeight = 0.1;
    const pstWeight = 0.12;
    const kingSafetyWeight = 0.2;
    const pawnStructureWeight = 0.15;

    let material = 0;
    let pst = 0;

    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 8; x += 1) {
        const piece = state.board[y][x];
        if (!piece) continue;
        const color = pieceColor(piece);
        const sign = color === perspective ? 1 : -1;
        const base = PIECE_VALUES[piece.toUpperCase()];
        material += sign * base;

        const pstTable = PST_MAP[piece.toUpperCase()];
        const indexY = color === 'w' ? y : 7 - y;
        pst += sign * pstTable[indexY][x];
      }
    }

    const mobility = generateLegalMoves(state, perspective, false).length - generateLegalMoves(state, opposite(perspective), false).length;
    const kingSafety = this.kingSafety(state, perspective) - this.kingSafety(state, opposite(perspective));
    const pawnStructure = this.pawnStructure(state, perspective) - this.pawnStructure(state, opposite(perspective));

    return (
      materialWeight * material +
      mobilityWeight * mobility +
      pstWeight * pst +
      kingSafetyWeight * kingSafety +
      pawnStructureWeight * pawnStructure
    );
  }

  private kingSafety(state: ChessState, color: Color): number {
    const king = findKing(state, color);
    if (!king) return -100;

    const enemyAttacks = generateLegalMoves(state, opposite(color), true);
    let danger = 0;
    enemyAttacks.forEach((move) => {
      if (Math.abs(move.to.x - king.x) <= 1 && Math.abs(move.to.y - king.y) <= 1) {
        danger += 1;
      }
    });

    return -danger;
  }

  private pawnStructure(state: ChessState, color: Color): number {
    const pawns: Array<{ x: number; y: number }> = [];
    const target = color === 'w' ? 'P' : 'p';

    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 8; x += 1) {
        if (state.board[y][x] === target) pawns.push({ x, y });
      }
    }

    let score = 0;
    const files = new Map<number, number>();
    pawns.forEach((pawn) => {
      files.set(pawn.x, (files.get(pawn.x) ?? 0) + 1);
    });

    pawns.forEach((pawn) => {
      const doubled = (files.get(pawn.x) ?? 0) > 1;
      if (doubled) score -= 8;

      const hasLeft = pawns.some((p) => p.x === pawn.x - 1);
      const hasRight = pawns.some((p) => p.x === pawn.x + 1);
      if (!hasLeft && !hasRight) score -= 6;

      const advance = color === 'w' ? 6 - pawn.y : pawn.y - 1;
      score += advance;
    });

    return score;
  }

  private orderMoves(moves: ChessMove[], ply: number): ChessMove[] {
    const killers = new Set(this.killerMoves.get(ply) ?? []);

    return moves
      .slice()
      .sort((a, b) => this.moveScore(b, killers) - this.moveScore(a, killers));
  }

  private moveScore(move: ChessMove, killers: Set<string>): number {
    const key = moveKey(move);
    let score = this.historyHeuristic.get(key) ?? 0;
    if (move.capture) {
      score += 1000 + (PIECE_VALUES[move.capture.toUpperCase()] ?? 0);
    }
    if (killers.has(key)) score += 800;
    if (move.promotion) score += 600;
    if (move.isCastle) score += 120;
    return score;
  }

  private pushKiller(move: ChessMove, ply: number): void {
    const list = this.killerMoves.get(ply) ?? [];
    const key = moveKey(move);
    if (list.includes(key)) return;
    const next = [key, ...list].slice(0, 2);
    this.killerMoves.set(ply, next);
  }

  private bumpHistory(move: ChessMove, depth: number): void {
    const key = moveKey(move);
    this.historyHeuristic.set(key, (this.historyHeuristic.get(key) ?? 0) + depth * depth);
  }

  private fenPrefix(state: ChessState): string {
    const rows = state.board
      .map((row) => {
        let out = '';
        let empty = 0;
        row.forEach((piece) => {
          if (!piece) {
            empty += 1;
            return;
          }
          if (empty > 0) {
            out += String(empty);
            empty = 0;
          }
          out += piece;
        });
        if (empty > 0) out += String(empty);
        return out;
      })
      .join('/');

    return `${rows} ${state.turn}`;
  }
}

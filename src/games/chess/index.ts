import type { EngineContext, GameHandle } from '@/engine/Scene';
import { createCanvasGame } from '@/games/common/canvasGame';
import { ArrowSystem } from './ArrowSystem';
import { ChessEngine, algebraicToSquare, squareToAlgebraic, type Piece, type Square } from './ChessEngine';
import { HighlightSystem } from './HighlightSystem';
import { MinimaxAI } from './MinimaxAI';
import { exportCoordinateLine, exportPGN, parseCoordinateLine } from './PGNParser';
import { ReplaySystem } from './ReplaySystem';
import type { ChessMove } from './MoveGenerator';

type ChessMode = 'ai' | 'human' | 'puzzle';

const PIECES: Record<string, string> = {
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

const PUZZLE_FEN = '8/5pk1/6p1/2p5/2P5/3r2P1/5P1P/3R2K1 w - - 0 1';

export function createGame(canvas: HTMLCanvasElement, engine: EngineContext): GameHandle {
  const chess = new ChessEngine();
  const ai = new MinimaxAI();
  const arrows = new ArrowSystem();
  const highlights = new HighlightSystem();
  const replay = new ReplaySystem();

  let mode: ChessMode = 'ai';
  let evaluation = 0;
  let draggingArrow = false;
  let resultText = '';
  let sessionStart = 0;
  let gameFinished = false;

  const unsubscribers: Array<() => void> = [];

  const boardGeometry = (width: number, height: number) => {
    const size = Math.min(height * 0.9, width * 0.78);
    const x = (width - size) / 2 - 30;
    const y = (height - size) / 2;
    const cell = size / 8;
    return { x, y, size, cell };
  };

  const toSquare = (clientX: number, clientY: number): Square | null => {
    const rect = canvas.getBoundingClientRect();
    const x = clientX > rect.width ? clientX - rect.left : clientX;
    const y = clientY > rect.height ? clientY - rect.top : clientY;

    const geo = boardGeometry(canvas.clientWidth, canvas.clientHeight);
    const bx = Math.floor((x - geo.x) / geo.cell);
    const by = Math.floor((y - geo.y) / geo.cell);
    if (bx < 0 || bx > 7 || by < 0 || by > 7) return null;
    return { x: bx, y: by };
  };

  const squarePiece = (sq: Square): Piece => chess.getBoard()[sq.y][sq.x];

  const updateResult = () => {
    const turn = chess.getTurn();
    if (chess.isCheckmate(turn)) {
      gameFinished = true;
      resultText = turn === 'w' ? 'Black wins by checkmate' : 'White wins by checkmate';
      engine.achievements.unlock('chess_mate');
      return;
    }
    if (chess.isStalemate(turn)) {
      gameFinished = true;
      resultText = 'Stalemate';
      return;
    }
    gameFinished = false;
    resultText = chess.isCheck(turn) ? `${turn === 'w' ? 'White' : 'Black'} in check` : '';
  };

  const selectSquare = (square: Square) => {
    if (gameFinished) return;

    const selected = highlights.getSelected();
    if (selected) {
      const move = highlights.findMove(square);
      if (move) {
        const played = chess.makeMove(move);
        if (played) {
          replay.push(move);
          highlights.clear();
          updateResult();
          return;
        }
      }
    }

    const piece = squarePiece(square);
    if (!piece) {
      highlights.clear();
      return;
    }

    const isWhite = piece === piece.toUpperCase();
    const turn = chess.getTurn();
    const matchesTurn = (turn === 'w' && isWhite) || (turn === 'b' && !isWhite);
    if (!matchesTurn) {
      highlights.clear();
      return;
    }

    highlights.select(square, chess.generateLegalMoves(turn));
  };

  const makeAIMove = () => {
    if (gameFinished) return;
    if (mode !== 'ai') return;
    if (chess.getTurn() !== 'b') return;

    const search = ai.search(chess.getState(), 'b', 4, 700);
    evaluation = search.score / 100;
    if (!search.move) {
      updateResult();
      return;
    }

    chess.makeMove(search.move);
    replay.push(search.move);
    highlights.clear();
    updateResult();
  };

  const reset = (nextMode: ChessMode = mode) => {
    mode = nextMode;
    if (nextMode === 'puzzle') chess.loadFEN(PUZZLE_FEN);
    else chess.reset();
    arrows.clear();
    replay.reset();
    highlights.clear();
    evaluation = 0;
    resultText = '';
    gameFinished = false;
  };

  const undo = () => {
    if (!chess.undo()) return;
    replay.undo();
    highlights.clear();
    updateResult();
  };

  const redo = () => {
    if (!chess.redo()) return;
    replay.redo();
    highlights.clear();
    updateResult();
  };

  const renderArrow = (ctx: CanvasRenderingContext2D, from: Square, to: Square, color: string, geo: { x: number; y: number; cell: number }) => {
    const sx = geo.x + from.x * geo.cell + geo.cell * 0.5;
    const sy = geo.y + from.y * geo.cell + geo.cell * 0.5;
    const tx = geo.x + to.x * geo.cell + geo.cell * 0.5;
    const ty = geo.y + to.y * geo.cell + geo.cell * 0.5;

    const angle = Math.atan2(ty - sy, tx - sx);
    const head = 12;

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(tx, ty);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx - Math.cos(angle - 0.4) * head, ty - Math.sin(angle - 0.4) * head);
    ctx.lineTo(tx - Math.cos(angle + 0.4) * head, ty - Math.sin(angle + 0.4) * head);
    ctx.closePath();
    ctx.fill();
  };

  const game = createCanvasGame(canvas, engine, {
    id: 'chess',
    onStart: () => {
      sessionStart = engine.profile.beginSession('chess');
      reset('ai');
      engine.input.setTarget(canvas);

      unsubscribers.push(
        engine.input.events.on('tap', ({ x, y }) => {
          const square = toSquare(x, y);
          if (square) {
            selectSquare(square);
          }
        }),
      );

      unsubscribers.push(
        engine.input.events.on('pointerdown', ({ x, y }) => {
          const square = toSquare(x, y);
          if (!square) return;
          if (draggingArrow) {
            arrows.start(square);
          }
        }),
      );

      unsubscribers.push(
        engine.input.events.on('pointermove', ({ x, y }) => {
          if (!draggingArrow) return;
          const square = toSquare(x, y);
          if (square) arrows.update(square);
        }),
      );

      unsubscribers.push(
        engine.input.events.on('pointerup', () => {
          if (!draggingArrow) return;
          arrows.end();
          draggingArrow = false;
        }),
      );

      unsubscribers.push(
        engine.input.events.on('longpress', ({ x, y }) => {
          const square = toSquare(x, y);
          if (!square) return;
          draggingArrow = true;
          arrows.start(square);
        }),
      );

      unsubscribers.push(
        engine.input.events.on('keydown', (event) => {
          if (event.key.toLowerCase() === 'c') arrows.clear();
          if (event.key.toLowerCase() === 'z') undo();
          if (event.key.toLowerCase() === 'y') redo();
          if (event.key.toLowerCase() === 'r') reset(mode);
          if (event.key.toLowerCase() === 'm') {
            mode = mode === 'ai' ? 'human' : mode === 'human' ? 'puzzle' : 'ai';
            reset(mode);
          }

          if (event.key.toLowerCase() === 'p') {
            console.log('PGN', exportPGN(chess.getHistory()));
            console.log('COORD', exportCoordinateLine(replay.list()));
          }

          if (event.key.toLowerCase() === 'i') {
            const coords = exportCoordinateLine(replay.list());
            const parsed = parseCoordinateLine(coords);
            parsed.forEach((token) => {
              const legal = chess.generateLegalMoves(chess.getTurn());
              const found = legal.find(
                (move) =>
                  squareToAlgebraic(move.from) === token.from &&
                  squareToAlgebraic(move.to) === token.to &&
                  (move.promotion ?? undefined) === (token.promotion ?? undefined),
              );
              if (found) chess.makeMove(found);
            });
          }
        }),
      );

      engine.ai.register(
        'chess',
        {
          tickAI: () => {
            makeAIMove();
          },
          onPlayerOverride: () => {
            engine.audio.playTone(140, 0.04, 'sine', 'sfx');
          },
        },
        { hz: 20 },
      );
      engine.ai.setCurrentGame('chess');
    },
    onStop: () => {
      unsubscribers.splice(0).forEach((u) => u());
      engine.ai.stop('chess');
      engine.ai.unregister('chess');
      engine.profile.endSession(sessionStart);
      engine.profile.setBestScore('chess', chess.getHistory().length);
    },
    update: () => {
      if (mode === 'ai' && chess.getTurn() === 'b' && !gameFinished) {
        makeAIMove();
      }
    },
    render: (ctx, width, height) => {
      const geo = boardGeometry(width, height);
      const board = chess.getBoard();

      ctx.fillStyle = '#0d1423';
      ctx.fillRect(0, 0, width, height);

      for (let y = 0; y < 8; y += 1) {
        for (let x = 0; x < 8; x += 1) {
          const dark = (x + y) % 2 === 1;
          ctx.fillStyle = dark ? '#3a4e70' : '#d8e5ff';
          ctx.fillRect(geo.x + x * geo.cell, geo.y + y * geo.cell, geo.cell, geo.cell);
        }
      }

      const selected = highlights.getSelected();
      if (selected) {
        ctx.fillStyle = 'rgba(254, 235, 130, 0.5)';
        ctx.fillRect(geo.x + selected.x * geo.cell, geo.y + selected.y * geo.cell, geo.cell, geo.cell);
      }

      highlights.getTargets().forEach((target) => {
        ctx.fillStyle = 'rgba(117, 226, 132, 0.45)';
        ctx.beginPath();
        ctx.arc(geo.x + target.x * geo.cell + geo.cell / 2, geo.y + target.y * geo.cell + geo.cell / 2, geo.cell * 0.15, 0, Math.PI * 2);
        ctx.fill();
      });

      arrows.getArrows().forEach((arrow) => {
        renderArrow(ctx, arrow.from, arrow.to, arrow.color, geo);
      });

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `${geo.cell * 0.72}px "Noto Sans Symbols 2", "Segoe UI Symbol", sans-serif`;
      for (let y = 0; y < 8; y += 1) {
        for (let x = 0; x < 8; x += 1) {
          const piece = board[y][x];
          if (!piece) continue;
          ctx.fillStyle = piece === piece.toUpperCase() ? '#fafcff' : '#121820';
          ctx.fillText(PIECES[piece], geo.x + x * geo.cell + geo.cell / 2, geo.y + y * geo.cell + geo.cell / 2 + 1);
        }
      }

      const evalX = geo.x + geo.size + 18;
      const evalH = geo.size;
      const evalW = 14;
      const normalized = Math.max(-10, Math.min(10, evaluation));
      const whitePct = (normalized + 10) / 20;

      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(evalX, geo.y, evalW, evalH);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(evalX, geo.y + evalH * (1 - whitePct), evalW, evalH * whitePct);
      ctx.fillStyle = '#f0f5ff';
      ctx.font = '600 12px "Space Grotesk", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(evaluation.toFixed(2), evalX - 6, geo.y + evalH + 16);

      ctx.fillStyle = '#edf4ff';
      ctx.font = '600 15px "Space Grotesk", sans-serif';
      ctx.fillText(`Turn: ${chess.getTurn() === 'w' ? 'White' : 'Black'}`, 18, 24);
      ctx.fillText(`Mode: ${mode.toUpperCase()} (M)`, 18, 46);
      ctx.fillText(`Moves: ${chess.getHistory().length}`, 18, 68);
      ctx.fillText('Tap select/move, long-press drag arrow, C clears arrows', 18, height - 20);

      if (resultText) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 28px "Space Grotesk", sans-serif';
        ctx.fillText(resultText, width * 0.34, height * 0.45);
      }
    },
    renderTextState: () => ({
      mode: gameFinished ? 'finished' : 'running',
      coordinates: 'origin top-left, +x right, +y down',
      game: 'chess',
      fen: chess.getFEN(),
      turn: chess.getTurn(),
      legalMoves: chess.generateLegalMoves().map((move) => `${squareToAlgebraic(move.from)}${squareToAlgebraic(move.to)}${move.promotion ?? ''}`),
      arrows: arrows.getArrows(),
      evaluation,
      resultText,
      history: chess.getHistory().map((entry) => entry.san),
    }),
    startAI: () => {
      engine.ai.start('chess');
      engine.achievements.unlock('ai_observer');
    },
    stopAI: () => engine.ai.stop('chess'),
  });

  return game;
}

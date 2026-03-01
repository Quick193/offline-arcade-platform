import type { EngineContext, GameHandle } from '@/engine/Scene';
import { createCanvasGame } from '@/games/common/canvasGame';
import { clamp } from '@/utils/math';

type Cell = 0 | 1 | 2;
type Player = 1 | 2;

type Board = Cell[][];

function makeBoard(): Board {
  return Array.from({ length: 6 }, () => Array.from({ length: 7 }, () => 0));
}

function cloneBoard(board: Board): Board {
  return board.map((row) => [...row]) as Board;
}

function availableRow(board: Board, col: number): number {
  for (let row = 5; row >= 0; row -= 1) {
    if (board[row][col] === 0) return row;
  }
  return -1;
}

function drop(board: Board, col: number, player: Player): Board | null {
  const row = availableRow(board, col);
  if (row < 0) return null;
  const next = cloneBoard(board);
  next[row][col] = player;
  return next;
}

function checkWinner(board: Board, player: Player): boolean {
  const directions = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ];

  for (let row = 0; row < 6; row += 1) {
    for (let col = 0; col < 7; col += 1) {
      if (board[row][col] !== player) continue;
      for (const [dx, dy] of directions) {
        let streak = 1;
        for (let step = 1; step < 4; step += 1) {
          const x = col + dx * step;
          const y = row + dy * step;
          if (x < 0 || x >= 7 || y < 0 || y >= 6) break;
          if (board[y][x] !== player) break;
          streak += 1;
        }
        if (streak >= 4) return true;
      }
    }
  }

  return false;
}

function lineScore(windowCells: Cell[], player: Player): number {
  const opponent = player === 1 ? 2 : 1;
  const countPlayer = windowCells.filter((value) => value === player).length;
  const countOpponent = windowCells.filter((value) => value === opponent).length;
  const countEmpty = windowCells.filter((value) => value === 0).length;

  if (countPlayer === 4) return 100000;
  if (countPlayer === 3 && countEmpty === 1) return 65;
  if (countPlayer === 2 && countEmpty === 2) return 9;
  if (countOpponent === 3 && countEmpty === 1) return -80;
  if (countOpponent === 4) return -100000;
  return 0;
}

function heuristic(board: Board, player: Player): number {
  let score = 0;

  const centerColumn = board.map((row) => row[3]);
  score += centerColumn.filter((value) => value === player).length * 7;

  for (let row = 0; row < 6; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      score += lineScore([board[row][col], board[row][col + 1], board[row][col + 2], board[row][col + 3]], player);
    }
  }

  for (let col = 0; col < 7; col += 1) {
    for (let row = 0; row < 3; row += 1) {
      score += lineScore([board[row][col], board[row + 1][col], board[row + 2][col], board[row + 3][col]], player);
    }
  }

  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      score += lineScore([board[row][col], board[row + 1][col + 1], board[row + 2][col + 2], board[row + 3][col + 3]], player);
    }
  }

  for (let row = 3; row < 6; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      score += lineScore([board[row][col], board[row - 1][col + 1], board[row - 2][col + 2], board[row - 3][col + 3]], player);
    }
  }

  return score;
}

function minimax(board: Board, depth: number, alpha: number, beta: number, maximizing: boolean, player: Player): { score: number; col: number } {
  const opponent: Player = player === 1 ? 2 : 1;

  if (checkWinner(board, player)) return { score: 1000000 + depth, col: -1 };
  if (checkWinner(board, opponent)) return { score: -1000000 - depth, col: -1 };
  const valid = Array.from({ length: 7 }, (_, index) => index).filter((col) => availableRow(board, col) >= 0);
  if (depth === 0 || valid.length === 0) {
    return { score: heuristic(board, player), col: valid[0] ?? 0 };
  }

  let bestCol = valid[0];

  if (maximizing) {
    let value = -Infinity;
    for (const col of valid) {
      const next = drop(board, col, player);
      if (!next) continue;
      const result = minimax(next, depth - 1, alpha, beta, false, player).score;
      if (result > value) {
        value = result;
        bestCol = col;
      }
      alpha = Math.max(alpha, value);
      if (alpha >= beta) break;
    }
    return { score: value, col: bestCol };
  }

  let value = Infinity;
  for (const col of valid) {
    const next = drop(board, col, opponent);
    if (!next) continue;
    const result = minimax(next, depth - 1, alpha, beta, true, player).score;
    if (result < value) {
      value = result;
      bestCol = col;
    }
    beta = Math.min(beta, value);
    if (alpha >= beta) break;
  }
  return { score: value, col: bestCol };
}

export function createGame(canvas: HTMLCanvasElement, engine: EngineContext): GameHandle {
  let board = makeBoard();
  let current: Player = 1;
  let winner: Player | 0 = 0;
  let hoverCol = 3;
  let score = { player: 0, ai: 0 };
  let sessionStart = 0;

  const unsubscribers: Array<() => void> = [];

  const resetBoard = () => {
    board = makeBoard();
    current = 1;
    winner = 0;
  };

  const playCol = (col: number) => {
    if (winner) return;
    const next = drop(board, col, current);
    if (!next) return;

    board = next;

    if (checkWinner(board, current)) {
      winner = current;
      if (winner === 1) score.player += 1;
      else score.ai += 1;
      return;
    }

    if (board.flat().every((cell) => cell !== 0)) {
      winner = 0;
      return;
    }

    current = current === 1 ? 2 : 1;
  };

  const aiMove = () => {
    if (winner || current !== 2) return;

    for (let col = 0; col < 7; col += 1) {
      const winBoard = drop(board, col, 2);
      if (winBoard && checkWinner(winBoard, 2)) {
        playCol(col);
        return;
      }
    }

    for (let col = 0; col < 7; col += 1) {
      const blockBoard = drop(board, col, 1);
      if (blockBoard && checkWinner(blockBoard, 1)) {
        playCol(col);
        return;
      }
    }

    const pick = minimax(board, 6, -Infinity, Infinity, true, 2).col;
    playCol(pick);
  };

  const game = createCanvasGame(canvas, engine, {
    id: 'connect4',
    onStart: () => {
      sessionStart = engine.profile.beginSession('connect4');
      resetBoard();
      engine.input.setTarget(canvas);

      unsubscribers.push(
        engine.input.events.on('keydown', (event) => {
          if (event.key.toLowerCase() === 'r') resetBoard();
          if (event.key === 'ArrowLeft') hoverCol = clamp(hoverCol - 1, 0, 6);
          if (event.key === 'ArrowRight') hoverCol = clamp(hoverCol + 1, 0, 6);
          if (event.key === ' ' || event.key === 'Enter') playCol(hoverCol);
          if (/^[1-7]$/.test(event.key)) playCol(Number(event.key) - 1);
        }),
      );
      unsubscribers.push(
        engine.input.events.on('tap', ({ x }) => {
          const col = clamp(Math.floor((x / canvas.clientWidth) * 7), 0, 6);
          playCol(col);
        }),
      );
      unsubscribers.push(
        engine.input.events.on('pointermove', ({ x }) => {
          hoverCol = clamp(Math.floor((x / canvas.clientWidth) * 7), 0, 6);
        }),
      );

      engine.ai.register(
        'connect4',
        {
          tickAI: () => aiMove(),
          onPlayerOverride: () => engine.audio.playTone(160, 0.04, 'square', 'sfx'),
        },
        { hz: 20 },
      );
      engine.ai.setCurrentGame('connect4');
    },
    onStop: () => {
      unsubscribers.splice(0).forEach((u) => u());
      engine.ai.stop('connect4');
      engine.ai.unregister('connect4');
      engine.profile.endSession(sessionStart);
      engine.profile.setBestScore('connect4', score.player);
    },
    update: () => {
      if (current === 2 && !winner) {
        aiMove();
      }
    },
    render: (ctx, width, height) => {
      const boardW = Math.min(width * 0.72, 560);
      const boardH = (boardW / 7) * 6;
      const startX = (width - boardW) / 2;
      const startY = (height - boardH) / 2;
      const cell = boardW / 7;

      ctx.fillStyle = '#0f1727';
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(startX + hoverCol * cell, startY - cell * 0.22, cell, cell * 0.18);

      ctx.fillStyle = '#1b63d8';
      ctx.fillRect(startX, startY, boardW, boardH);

      for (let row = 0; row < 6; row += 1) {
        for (let col = 0; col < 7; col += 1) {
          const value = board[row][col];
          const cx = startX + col * cell + cell / 2;
          const cy = startY + row * cell + cell / 2;
          ctx.fillStyle = '#10294f';
          ctx.beginPath();
          ctx.arc(cx, cy, cell * 0.38, 0, Math.PI * 2);
          ctx.fill();

          if (value) {
            ctx.fillStyle = value === 1 ? '#f0cf42' : '#ff5b73';
            ctx.beginPath();
            ctx.arc(cx, cy, cell * 0.34, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      ctx.fillStyle = '#eaf3ff';
      ctx.font = '600 16px "Space Grotesk", sans-serif';
      ctx.fillText(`You: ${score.player}  AI: ${score.ai}`, 24, 28);
      ctx.fillText(`Turn: ${current === 1 ? 'You' : 'AI'}`, 24, 52);

      if (winner) {
        ctx.fillStyle = 'rgba(0,0,0,0.58)';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#fff';
        ctx.font = '700 30px "Space Grotesk", sans-serif';
        ctx.fillText(winner === 1 ? 'Player wins' : 'AI wins', width * 0.4, height * 0.45);
      }
    },
    renderTextState: () => ({
      mode: winner ? 'finished' : 'running',
      coordinates: 'origin top-left, +x right, +y down',
      game: 'connect4',
      board,
      turn: current,
      winner,
      score,
    }),
    startAI: () => {
      engine.ai.start('connect4');
      engine.achievements.unlock('ai_observer');
    },
    stopAI: () => engine.ai.stop('connect4'),
  });

  return game;
}

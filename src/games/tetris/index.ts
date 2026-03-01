import type { EngineContext, GameHandle } from '@/engine/Scene';
import { createCanvasGame } from '@/games/common/canvasGame';
import { clamp, randInt } from '@/utils/math';

type TetrominoType = 'I' | 'J' | 'L' | 'O' | 'S' | 'T' | 'Z';

interface ActivePiece {
  type: TetrominoType;
  rotation: number;
  x: number;
  y: number;
}

type GameMode = 'marathon' | 'sprint' | 'ultra';

const WIDTH = 10;
const HEIGHT = 20;

const PIECES: Record<TetrominoType, number[][][]> = {
  I: [
    [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    [[0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0]],
    [[0, 0, 0, 0], [0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0]],
    [[0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0]],
  ],
  J: [
    [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
    [[0, 1, 1], [0, 1, 0], [0, 1, 0]],
    [[0, 0, 0], [1, 1, 1], [0, 0, 1]],
    [[0, 1, 0], [0, 1, 0], [1, 1, 0]],
  ],
  L: [
    [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
    [[0, 1, 0], [0, 1, 0], [0, 1, 1]],
    [[0, 0, 0], [1, 1, 1], [1, 0, 0]],
    [[1, 1, 0], [0, 1, 0], [0, 1, 0]],
  ],
  O: [
    [[1, 1], [1, 1]],
    [[1, 1], [1, 1]],
    [[1, 1], [1, 1]],
    [[1, 1], [1, 1]],
  ],
  S: [
    [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
    [[0, 1, 0], [0, 1, 1], [0, 0, 1]],
    [[0, 0, 0], [0, 1, 1], [1, 1, 0]],
    [[1, 0, 0], [1, 1, 0], [0, 1, 0]],
  ],
  T: [
    [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
    [[0, 1, 0], [0, 1, 1], [0, 1, 0]],
    [[0, 0, 0], [1, 1, 1], [0, 1, 0]],
    [[0, 1, 0], [1, 1, 0], [0, 1, 0]],
  ],
  Z: [
    [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
    [[0, 0, 1], [0, 1, 1], [0, 1, 0]],
    [[0, 0, 0], [1, 1, 0], [0, 1, 1]],
    [[0, 1, 0], [1, 1, 0], [1, 0, 0]],
  ],
};

const COLOR_MAP: Record<number, string> = {
  0: '#0e1421',
  1: '#2dc7ff',
  2: '#3a66ff',
  3: '#ff9a2f',
  4: '#ffe14b',
  5: '#4eff97',
  6: '#d04bff',
  7: '#ff4b6e',
};

const TYPE_ORDER: TetrominoType[] = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];
const TYPE_TO_NUM: Record<TetrominoType, number> = { I: 1, J: 2, L: 3, O: 4, S: 5, T: 6, Z: 7 };

function makeBoard(): number[][] {
  return Array.from({ length: HEIGHT }, () => Array.from({ length: WIDTH }, () => 0));
}

function cloneBoard(board: number[][]): number[][] {
  return board.map((row) => [...row]);
}

function getBag(): TetrominoType[] {
  const bag = [...TYPE_ORDER];
  for (let i = bag.length - 1; i > 0; i -= 1) {
    const j = randInt(0, i);
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

function getShape(piece: ActivePiece): number[][] {
  return PIECES[piece.type][piece.rotation];
}

function collides(board: number[][], piece: ActivePiece, x = piece.x, y = piece.y, rotation = piece.rotation): boolean {
  const shape = PIECES[piece.type][rotation];
  for (let row = 0; row < shape.length; row += 1) {
    for (let col = 0; col < shape[row].length; col += 1) {
      if (!shape[row][col]) continue;
      const tx = x + col;
      const ty = y + row;
      if (tx < 0 || tx >= WIDTH || ty >= HEIGHT) return true;
      if (ty >= 0 && board[ty][tx] !== 0) return true;
    }
  }
  return false;
}

function mergePiece(board: number[][], piece: ActivePiece): number[][] {
  const copy = cloneBoard(board);
  const shape = getShape(piece);
  for (let row = 0; row < shape.length; row += 1) {
    for (let col = 0; col < shape[row].length; col += 1) {
      if (!shape[row][col]) continue;
      const tx = piece.x + col;
      const ty = piece.y + row;
      if (ty >= 0 && ty < HEIGHT && tx >= 0 && tx < WIDTH) {
        copy[ty][tx] = TYPE_TO_NUM[piece.type];
      }
    }
  }
  return copy;
}

function clearLines(board: number[][]): { board: number[][]; cleared: number } {
  const next = board.filter((row) => row.some((cell) => cell === 0));
  const cleared = HEIGHT - next.length;
  while (next.length < HEIGHT) {
    next.unshift(Array.from({ length: WIDTH }, () => 0));
  }
  return { board: next, cleared };
}

function evaluateBoard(board: number[][]): { aggregateHeight: number; holes: number; bumpiness: number; lines: number } {
  const heights: number[] = [];
  let holes = 0;
  let lines = 0;

  for (let row = 0; row < HEIGHT; row += 1) {
    if (board[row].every((value) => value !== 0)) lines += 1;
  }

  for (let col = 0; col < WIDTH; col += 1) {
    let top = -1;
    for (let row = 0; row < HEIGHT; row += 1) {
      if (board[row][col] !== 0) {
        top = row;
        break;
      }
    }

    if (top === -1) {
      heights.push(0);
      continue;
    }

    const height = HEIGHT - top;
    heights.push(height);

    for (let row = top + 1; row < HEIGHT; row += 1) {
      if (board[row][col] === 0) holes += 1;
    }
  }

  let bumpiness = 0;
  for (let i = 0; i < heights.length - 1; i += 1) {
    bumpiness += Math.abs(heights[i] - heights[i + 1]);
  }

  return {
    aggregateHeight: heights.reduce((sum, value) => sum + value, 0),
    holes,
    bumpiness,
    lines,
  };
}

function detectTSpin(board: number[][], piece: ActivePiece): boolean {
  if (piece.type !== 'T') return false;
  const cx = piece.x + 1;
  const cy = piece.y + 1;
  let blockedCorners = 0;
  const corners = [
    [cx - 1, cy - 1],
    [cx + 1, cy - 1],
    [cx - 1, cy + 1],
    [cx + 1, cy + 1],
  ];

  corners.forEach(([x, y]) => {
    if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT || board[y][x] !== 0) {
      blockedCorners += 1;
    }
  });

  return blockedCorners >= 3;
}

export function createGame(canvas: HTMLCanvasElement, engine: EngineContext): GameHandle {
  const board = makeBoard();
  let mode: GameMode = 'marathon';
  let active: ActivePiece = { type: 'I', rotation: 0, x: 3, y: 0 };
  let bag: TetrominoType[] = [];
  let nextQueue: TetrominoType[] = [];
  let hold: TetrominoType | null = null;
  let canHold = true;
  let score = 0;
  let lines = 0;
  let combo = -1;
  let backToBack = 0;
  let dropTimer = 0;
  let elapsedTime = 0;
  let gameOver = false;
  let lastRotate = false;
  let lockTimer = 0;
  let sessionStart = 0;

  const unsubscribers: Array<() => void> = [];

  const refillQueue = () => {
    while (nextQueue.length < 14) {
      if (bag.length === 0) bag = getBag();
      const value = bag.shift();
      if (value) nextQueue.push(value);
    }
  };

  const spawn = () => {
    refillQueue();
    const type = nextQueue.shift() ?? 'I';
    active = { type, rotation: 0, x: 3, y: -1 };
    canHold = true;
    lastRotate = false;
    if (collides(board, active)) {
      gameOver = true;
    }
  };

  const hardDropY = (): number => {
    let ghostY = active.y;
    while (!collides(board, active, active.x, ghostY + 1)) {
      ghostY += 1;
    }
    return ghostY;
  };

  const tryMove = (dx: number, dy: number): boolean => {
    const nx = active.x + dx;
    const ny = active.y + dy;
    if (collides(board, active, nx, ny)) return false;
    active.x = nx;
    active.y = ny;
    return true;
  };

  const rotate = () => {
    const nextRotation = (active.rotation + 1) % 4;
    const kicks: Array<[number, number]> = [[0, 0], [1, 0], [-1, 0], [0, -1], [2, 0], [-2, 0]];
    for (const [kx, ky] of kicks) {
      if (!collides(board, active, active.x + kx, active.y + ky, nextRotation)) {
        active.rotation = nextRotation;
        active.x += kx;
        active.y += ky;
        lastRotate = true;
        return;
      }
    }
  };

  const doHold = () => {
    if (!canHold) return;
    if (!hold) {
      hold = active.type;
      spawn();
    } else {
      const swap = hold;
      hold = active.type;
      active = { type: swap, rotation: 0, x: 3, y: -1 };
      if (collides(board, active)) gameOver = true;
    }
    canHold = false;
  };

  const applyScore = (cleared: number, tSpin: boolean) => {
    let gained = 0;
    if (tSpin) {
      gained += [400, 800, 1200, 1600][cleared] ?? 0;
    } else {
      gained += [0, 100, 300, 500, 800][cleared] ?? 0;
    }

    if (cleared > 0) {
      combo += 1;
      gained += combo > 0 ? combo * 50 : 0;
      if (cleared === 4 || tSpin) {
        backToBack += 1;
        gained = Math.round(gained * (backToBack > 1 ? 1.5 : 1));
      } else {
        backToBack = 0;
      }
    } else {
      combo = -1;
    }

    score += gained;
    lines += cleared;

    if (mode === 'sprint' && lines >= 40) {
      gameOver = true;
    }
    if (mode === 'ultra' && elapsedTime >= 180) {
      gameOver = true;
    }

    if (cleared > 0) {
      engine.audio.playTone(220 + cleared * 90, 0.1, 'square', 'sfx');
      engine.particles.emitBurst(120, 80, '#7ef8ff', 18 + cleared * 3);
    }
  };

  const lockPiece = () => {
    const lockedBoard = mergePiece(board, active);
    lockedBoard.forEach((row, index) => {
      board[index] = row;
    });

    const tSpin = lastRotate && detectTSpin(board, active);
    const clearedData = clearLines(board);
    clearedData.board.forEach((row, index) => {
      board[index] = row;
    });

    if (clearedData.cleared > 0 && board.every((row) => row.every((value) => value === 0))) {
      score += 3000;
    }

    applyScore(clearedData.cleared, tSpin);
    spawn();
    lockTimer = 0;
    lastRotate = false;
  };

  const doHardDrop = () => {
    active.y = hardDropY();
    score += 2;
    lockPiece();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (gameOver && event.key.toLowerCase() === 'r') {
      reset();
      return;
    }

    if (event.key === 'ArrowLeft') tryMove(-1, 0);
    if (event.key === 'ArrowRight') tryMove(1, 0);
    if (event.key === 'ArrowDown') {
      if (tryMove(0, 1)) score += 1;
    }
    if (event.key === 'ArrowUp') rotate();
    if (event.key === ' ') doHardDrop();
    if (event.key.toLowerCase() === 'c') doHold();

    if (event.key === '1') mode = 'marathon';
    if (event.key === '2') mode = 'sprint';
    if (event.key === '3') mode = 'ultra';
  };

  const reset = () => {
    for (let row = 0; row < HEIGHT; row += 1) {
      for (let col = 0; col < WIDTH; col += 1) {
        board[row][col] = 0;
      }
    }
    nextQueue = [];
    bag = [];
    hold = null;
    score = 0;
    lines = 0;
    combo = -1;
    backToBack = 0;
    dropTimer = 0;
    elapsedTime = 0;
    gameOver = false;
    spawn();
  };

  const evaluatePlacement = (testPiece: ActivePiece): number => {
    let drop = testPiece.y;
    while (!collides(board, testPiece, testPiece.x, drop + 1, testPiece.rotation)) {
      drop += 1;
    }

    const placed = { ...testPiece, y: drop };
    const merged = mergePiece(board, placed);
    const cleared = clearLines(merged).board;
    const stats = evaluateBoard(cleared);
    const tSpinBonus = testPiece.type === 'T' ? 1 : 0;

    return (
      -0.51 * stats.aggregateHeight +
      0.76 * stats.lines -
      0.36 * stats.holes -
      0.18 * stats.bumpiness +
      1.2 * tSpinBonus
    );
  };

  const aiMove = () => {
    if (gameOver) return;

    let bestScore = -Infinity;
    let best: { x: number; rotation: number } | null = null;

    for (let rotation = 0; rotation < 4; rotation += 1) {
      for (let x = -2; x < WIDTH + 2; x += 1) {
        const testPiece: ActivePiece = { ...active, rotation, x, y: -1 };
        if (collides(board, testPiece, x, -1, rotation)) continue;
        const candidate = evaluatePlacement(testPiece);
        if (candidate > bestScore) {
          bestScore = candidate;
          best = { x, rotation };
        }
      }
    }

    if (!best) return;
    active.rotation = best.rotation;
    active.x = clamp(best.x, -2, WIDTH - 1);
    doHardDrop();
  };

  const game = createCanvasGame(canvas, engine, {
    id: 'tetris',
    onStart: () => {
      reset();
      sessionStart = engine.profile.beginSession('tetris');
      engine.achievements.unlock('first_game');
      engine.ai.register(
        'tetris',
        {
          tickAI: () => aiMove(),
          onPlayerOverride: () => {
            engine.audio.playTone(160, 0.05, 'triangle', 'sfx');
          },
        },
        { hz: 20 },
      );

      engine.input.setTarget(canvas);
      unsubscribers.push(engine.input.events.on('keydown', onKeyDown));
      unsubscribers.push(
        engine.input.events.on('tap', () => {
          rotate();
        }),
      );
      unsubscribers.push(
        engine.input.events.on('doubletap', () => {
          doHardDrop();
        }),
      );
      unsubscribers.push(
        engine.input.events.on('swipe', (swipe) => {
          if (swipe.direction === 'left') tryMove(-1, 0);
          if (swipe.direction === 'right') tryMove(1, 0);
          if (swipe.direction === 'down') tryMove(0, 1);
        }),
      );
      engine.ai.setCurrentGame('tetris');
    },
    onStop: () => {
      unsubscribers.splice(0).forEach((dispose) => dispose());
      engine.ai.stop('tetris');
      engine.ai.unregister('tetris');
      engine.profile.endSession(sessionStart);
      engine.profile.setBestScore('tetris', score);
    },
    update: (deltaTime) => {
      if (gameOver) return;

      elapsedTime += deltaTime;
      const level = Math.floor(lines / 10) + 1;
      const gravity = mode === 'ultra' ? 0.06 : Math.max(0.08, 0.8 - level * 0.06);

      dropTimer += deltaTime;
      if (dropTimer >= gravity) {
        dropTimer = 0;
        if (!tryMove(0, 1)) {
          lockTimer += gravity;
          if (lockTimer > 0.35) {
            lockPiece();
          }
        } else {
          lockTimer = 0;
        }
      }
    },
    render: (ctx, width, height) => {
      const cell = Math.floor(Math.min(width / 20, height / 24));
      const ox = Math.floor(width * 0.18);
      const oy = Math.floor(height * 0.08);

      ctx.fillStyle = '#0b111a';
      ctx.fillRect(0, 0, width, height);

      for (let row = 0; row < HEIGHT; row += 1) {
        for (let col = 0; col < WIDTH; col += 1) {
          const value = board[row][col];
          ctx.fillStyle = value ? COLOR_MAP[value] : '#122036';
          ctx.fillRect(ox + col * cell, oy + row * cell, cell - 1, cell - 1);

          if (value) {
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.fillRect(ox + col * cell + 2, oy + row * cell + 2, cell - 8, 4);
          }
        }
      }

      const ghostY = hardDropY();
      const ghost = { ...active, y: ghostY };
      const ghostShape = getShape(ghost);
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      for (let row = 0; row < ghostShape.length; row += 1) {
        for (let col = 0; col < ghostShape[row].length; col += 1) {
          if (!ghostShape[row][col]) continue;
          const x = ghost.x + col;
          const y = ghost.y + row;
          if (y >= 0) ctx.fillRect(ox + x * cell, oy + y * cell, cell - 1, cell - 1);
        }
      }

      const activeShape = getShape(active);
      for (let row = 0; row < activeShape.length; row += 1) {
        for (let col = 0; col < activeShape[row].length; col += 1) {
          if (!activeShape[row][col]) continue;
          const x = active.x + col;
          const y = active.y + row;
          if (y < 0) continue;
          ctx.fillStyle = COLOR_MAP[TYPE_TO_NUM[active.type]];
          ctx.fillRect(ox + x * cell, oy + y * cell, cell - 1, cell - 1);
          ctx.fillStyle = 'rgba(255,255,255,0.23)';
          ctx.fillRect(ox + x * cell + 2, oy + y * cell + 2, cell - 8, 4);
        }
      }

      ctx.fillStyle = '#f1f6ff';
      ctx.font = '600 16px "Space Grotesk", sans-serif';
      ctx.fillText(`Mode: ${mode.toUpperCase()}`, width * 0.65, height * 0.16);
      ctx.fillText(`Score: ${score}`, width * 0.65, height * 0.22);
      ctx.fillText(`Lines: ${lines}`, width * 0.65, height * 0.28);
      ctx.fillText(`Combo: ${Math.max(0, combo)}`, width * 0.65, height * 0.34);
      ctx.fillText(`B2B: ${backToBack}`, width * 0.65, height * 0.40);

      if (hold) {
        ctx.fillText(`Hold: ${hold}`, width * 0.65, height * 0.5);
      }

      if (gameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.58)';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 28px "Space Grotesk", sans-serif';
        ctx.fillText('GAME OVER', width * 0.36, height * 0.45);
        ctx.font = '500 16px "Space Grotesk", sans-serif';
        ctx.fillText('Press R to restart', width * 0.39, height * 0.52);
      }
    },
    renderTextState: () => ({
      mode: gameOver ? 'game_over' : 'running',
      coordinates: 'origin top-left, +x right, +y down',
      game: 'tetris',
      activePiece: active,
      ghostY: hardDropY(),
      score,
      lines,
      combo,
      backToBack,
      queue: nextQueue.slice(0, 5),
      hold,
      elapsedTime,
    }),
    startAI: () => {
      engine.ai.start('tetris');
      engine.achievements.unlock('ai_observer');
    },
    stopAI: () => {
      engine.ai.stop('tetris');
    },
  });

  return game;
}

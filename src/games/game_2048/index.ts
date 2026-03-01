import type { EngineContext, GameHandle } from '@/engine/Scene';
import { createCanvasGame } from '@/games/common/canvasGame';
import { chance, randInt } from '@/utils/math';

type Grid = number[][];
type MoveDir = 'up' | 'down' | 'left' | 'right';

function createGrid(): Grid {
  return Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => 0));
}

function cloneGrid(grid: Grid): Grid {
  return grid.map((row) => [...row]);
}

function rotateGrid(grid: Grid): Grid {
  const out = createGrid();
  for (let y = 0; y < 4; y += 1) {
    for (let x = 0; x < 4; x += 1) {
      out[x][3 - y] = grid[y][x];
    }
  }
  return out;
}

function moveLeft(grid: Grid): { grid: Grid; moved: boolean; gained: number } {
  const next = createGrid();
  let moved = false;
  let gained = 0;

  for (let y = 0; y < 4; y += 1) {
    const row = grid[y].filter((value) => value !== 0);
    const merged: number[] = [];

    for (let i = 0; i < row.length; i += 1) {
      if (row[i] !== 0 && row[i] === row[i + 1]) {
        const value = row[i] * 2;
        merged.push(value);
        gained += value;
        i += 1;
      } else {
        merged.push(row[i]);
      }
    }

    while (merged.length < 4) merged.push(0);

    for (let x = 0; x < 4; x += 1) {
      next[y][x] = merged[x];
      if (next[y][x] !== grid[y][x]) moved = true;
    }
  }

  return { grid: next, moved, gained };
}

function applyMove(grid: Grid, dir: MoveDir): { grid: Grid; moved: boolean; gained: number } {
  let transformed = cloneGrid(grid);

  if (dir === 'up') transformed = rotateGrid(rotateGrid(rotateGrid(transformed)));
  if (dir === 'right') transformed = rotateGrid(rotateGrid(transformed));
  if (dir === 'down') transformed = rotateGrid(transformed);

  const moved = moveLeft(transformed);
  let restored = moved.grid;

  if (dir === 'up') restored = rotateGrid(restored);
  if (dir === 'right') restored = rotateGrid(rotateGrid(restored));
  if (dir === 'down') restored = rotateGrid(rotateGrid(rotateGrid(restored)));

  return { grid: restored, moved: moved.moved, gained: moved.gained };
}

function spawnTile(grid: Grid): Grid {
  const empty: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < 4; y += 1) {
    for (let x = 0; x < 4; x += 1) {
      if (grid[y][x] === 0) empty.push({ x, y });
    }
  }
  if (!empty.length) return grid;

  const chosen = empty[randInt(0, empty.length - 1)];
  const value = chance(0.1) ? 4 : 2;
  const next = cloneGrid(grid);
  next[chosen.y][chosen.x] = value;
  return next;
}

function smoothness(grid: Grid): number {
  let value = 0;
  for (let y = 0; y < 4; y += 1) {
    for (let x = 0; x < 4; x += 1) {
      if (!grid[y][x]) continue;
      if (x < 3 && grid[y][x + 1]) value -= Math.abs(Math.log2(grid[y][x]) - Math.log2(grid[y][x + 1]));
      if (y < 3 && grid[y + 1][x]) value -= Math.abs(Math.log2(grid[y][x]) - Math.log2(grid[y + 1][x]));
    }
  }
  return value;
}

function monotonicity(grid: Grid): number {
  let score = 0;
  for (let y = 0; y < 4; y += 1) {
    for (let x = 0; x < 3; x += 1) {
      score += grid[y][x] >= grid[y][x + 1] ? 1 : -1;
      score += grid[x][y] >= grid[x + 1][y] ? 1 : -1;
    }
  }
  return score;
}

function evaluateGrid(grid: Grid): number {
  const empty = grid.flat().filter((value) => value === 0).length;
  const maxTile = Math.max(...grid.flat());
  return smoothness(grid) * 1.15 + monotonicity(grid) * 0.8 + empty * 2.7 + Math.log2(maxTile || 2) * 1.5;
}

function expectimax(grid: Grid, depth: number, playerTurn: boolean): number {
  if (depth === 0) return evaluateGrid(grid);

  if (playerTurn) {
    let best = -Infinity;
    (['up', 'down', 'left', 'right'] as MoveDir[]).forEach((dir) => {
      const moved = applyMove(grid, dir);
      if (!moved.moved) return;
      best = Math.max(best, expectimax(moved.grid, depth - 1, false));
    });
    return best === -Infinity ? evaluateGrid(grid) : best;
  }

  const empties: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < 4; y += 1) {
    for (let x = 0; x < 4; x += 1) {
      if (!grid[y][x]) empties.push({ x, y });
    }
  }

  if (!empties.length) return evaluateGrid(grid);

  let sum = 0;
  empties.forEach(({ x, y }) => {
    const with2 = cloneGrid(grid);
    with2[y][x] = 2;
    sum += 0.9 * expectimax(with2, depth - 1, true);

    const with4 = cloneGrid(grid);
    with4[y][x] = 4;
    sum += 0.1 * expectimax(with4, depth - 1, true);
  });

  return sum / empties.length;
}

export function createGame(canvas: HTMLCanvasElement, engine: EngineContext): GameHandle {
  let grid = createGrid();
  let undoBuffer: Grid[] = [];
  let score = 0;
  let best = engine.profile.get().bestScores.game_2048 ?? 0;
  let tween = 0;
  let gameOver = false;
  let sessionStart = 0;

  const unsubscribers: Array<() => void> = [];

  const reset = () => {
    grid = createGrid();
    grid = spawnTile(spawnTile(grid));
    undoBuffer = [];
    score = 0;
    tween = 1;
    gameOver = false;
  };

  const canMove = (): boolean => {
    return (['up', 'down', 'left', 'right'] as MoveDir[]).some((dir) => applyMove(grid, dir).moved);
  };

  const move = (dir: MoveDir) => {
    if (gameOver) return;
    const next = applyMove(grid, dir);
    if (!next.moved) return;

    undoBuffer.push(cloneGrid(grid));
    undoBuffer = undoBuffer.slice(-20);

    grid = spawnTile(next.grid);
    score += next.gained;
    best = Math.max(best, score);
    tween = 1;

    if (!canMove()) {
      gameOver = true;
    }
  };

  const undo = () => {
    const prev = undoBuffer.pop();
    if (!prev) return;
    grid = prev;
    gameOver = false;
  };

  const aiMove = () => {
    if (gameOver) return;

    let bestDir: MoveDir | null = null;
    let bestEval = -Infinity;

    (['up', 'down', 'left', 'right'] as MoveDir[]).forEach((dir) => {
      const moved = applyMove(grid, dir);
      if (!moved.moved) return;
      const evalValue = expectimax(moved.grid, 4, false);
      if (evalValue > bestEval) {
        bestEval = evalValue;
        bestDir = dir;
      }
    });

    if (bestDir) move(bestDir);
  };

  const game = createCanvasGame(canvas, engine, {
    id: 'game_2048',
    onStart: () => {
      sessionStart = engine.profile.beginSession('game_2048');
      reset();
      engine.input.setTarget(canvas);

      unsubscribers.push(
        engine.input.events.on('keydown', (event) => {
          if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') move('left');
          if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') move('right');
          if (event.key === 'ArrowUp' || event.key.toLowerCase() === 'w') move('up');
          if (event.key === 'ArrowDown' || event.key.toLowerCase() === 's') move('down');
          if (event.key.toLowerCase() === 'u') undo();
          if (event.key.toLowerCase() === 'r') reset();
        }),
      );

      unsubscribers.push(
        engine.input.events.on('swipe', (swipe) => {
          if (swipe.direction === 'left') move('left');
          if (swipe.direction === 'right') move('right');
          if (swipe.direction === 'up') move('up');
          if (swipe.direction === 'down') move('down');
        }),
      );

      engine.ai.register(
        'game_2048',
        {
          tickAI: () => aiMove(),
          onPlayerOverride: () => {
            engine.audio.playTone(200, 0.05, 'sine', 'sfx');
          },
        },
        { hz: 20 },
      );
      engine.ai.setCurrentGame('game_2048');
    },
    onStop: () => {
      unsubscribers.splice(0).forEach((u) => u());
      engine.ai.stop('game_2048');
      engine.ai.unregister('game_2048');
      engine.profile.endSession(sessionStart);
      engine.profile.setBestScore('game_2048', best);
    },
    update: (deltaTime) => {
      tween = Math.max(0, tween - deltaTime * 2.5);
    },
    render: (ctx, width, height) => {
      const size = Math.min(width, height) * 0.75;
      const startX = (width - size) / 2;
      const startY = (height - size) / 2;
      const tile = size / 4;

      ctx.fillStyle = '#111a2c';
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = '#253654';
      ctx.fillRect(startX, startY, size, size);

      for (let y = 0; y < 4; y += 1) {
        for (let x = 0; x < 4; x += 1) {
          const value = grid[y][x];
          const px = startX + x * tile;
          const py = startY + y * tile;

          const palette: Record<number, string> = {
            0: '#1a2843',
            2: '#f7f3ea',
            4: '#f8db97',
            8: '#f7b35c',
            16: '#ff9252',
            32: '#ff7859',
            64: '#ff5567',
            128: '#ffd966',
            256: '#f6d14a',
            512: '#ffe13f',
            1024: '#edff5f',
            2048: '#92ff7f',
          };

          ctx.fillStyle = palette[value] ?? '#7bc3ff';
          const pulse = value ? 1 + tween * 0.06 : 1;
          const pad = 7;
          const cw = tile - pad * 2;
          const ch = tile - pad * 2;
          ctx.fillRect(px + pad + (cw * (1 - pulse)) / 2, py + pad + (ch * (1 - pulse)) / 2, cw * pulse, ch * pulse);

          if (value) {
            ctx.fillStyle = value <= 4 ? '#1a2435' : '#f9fbff';
            ctx.font = `700 ${Math.max(16, 32 - String(value).length * 4)}px "Space Grotesk", sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(value), px + tile / 2, py + tile / 2 + 1);
          }
        }
      }

      ctx.textAlign = 'left';
      ctx.fillStyle = '#e7f0ff';
      ctx.font = '600 16px "Space Grotesk", sans-serif';
      ctx.fillText(`Score: ${score}`, 24, 30);
      ctx.fillText(`Best: ${best}`, 24, 54);
      ctx.fillText('Arrows/Swipe to move, U to undo', 24, height - 26);

      if (gameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#fff';
        ctx.font = '700 30px "Space Grotesk", sans-serif';
        ctx.fillText('No moves left', width * 0.39, height * 0.45);
        ctx.font = '500 16px "Space Grotesk", sans-serif';
        ctx.fillText('Press R to restart', width * 0.42, height * 0.52);
      }
    },
    renderTextState: () => ({
      mode: gameOver ? 'game_over' : 'running',
      coordinates: 'origin top-left, +x right, +y down',
      game: 'game_2048',
      grid,
      score,
      best,
    }),
    startAI: () => {
      engine.ai.start('game_2048');
      engine.achievements.unlock('ai_observer');
    },
    stopAI: () => engine.ai.stop('game_2048'),
  });

  return game;
}

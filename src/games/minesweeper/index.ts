import type { EngineContext, GameHandle } from '@/engine/Scene';
import { createCanvasGame } from '@/games/common/canvasGame';
import { clamp, randInt } from '@/utils/math';

interface Tile {
  mine: boolean;
  revealed: boolean;
  flagged: boolean;
  count: number;
}

type Difficulty = 'easy' | 'medium' | 'hard';

const LEVELS: Record<Difficulty, { w: number; h: number; mines: number }> = {
  easy: { w: 9, h: 9, mines: 10 },
  medium: { w: 16, h: 16, mines: 40 },
  hard: { w: 20, h: 20, mines: 80 },
};

function neighbors(x: number, y: number, w: number, h: number): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < w && ny >= 0 && ny < h) out.push({ x: nx, y: ny });
    }
  }
  return out;
}

export function createGame(canvas: HTMLCanvasElement, engine: EngineContext): GameHandle {
  let difficulty: Difficulty = 'medium';
  let grid: Tile[][] = [];
  let width = 16;
  let height = 16;
  let mineCount = 40;
  let firstClick = true;
  let exploded = false;
  let won = false;
  let flags = 0;
  let revealedCount = 0;
  let cursor = { x: 0, y: 0 };
  let sessionStart = 0;

  const unsubscribers: Array<() => void> = [];

  const setup = () => {
    const cfg = LEVELS[difficulty];
    width = cfg.w;
    height = cfg.h;
    mineCount = cfg.mines;
    grid = Array.from({ length: height }, () =>
      Array.from({ length: width }, () => ({ mine: false, revealed: false, flagged: false, count: 0 })),
    );
    firstClick = true;
    exploded = false;
    won = false;
    flags = 0;
    revealedCount = 0;
    cursor = { x: Math.floor(width / 2), y: Math.floor(height / 2) };
  };

  const placeMines = (safeX: number, safeY: number) => {
    let placed = 0;
    while (placed < mineCount) {
      const x = randInt(0, width - 1);
      const y = randInt(0, height - 1);
      if (grid[y][x].mine) continue;
      if (Math.abs(x - safeX) <= 1 && Math.abs(y - safeY) <= 1) continue;
      grid[y][x].mine = true;
      placed += 1;
    }

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        grid[y][x].count = neighbors(x, y, width, height).filter(({ x: nx, y: ny }) => grid[ny][nx].mine).length;
      }
    }
  };

  const floodReveal = (x: number, y: number) => {
    const queue = [{ x, y }];
    while (queue.length) {
      const node = queue.shift()!;
      const tile = grid[node.y][node.x];
      if (tile.revealed || tile.flagged) continue;
      tile.revealed = true;
      revealedCount += 1;

      if (tile.count === 0) {
        neighbors(node.x, node.y, width, height).forEach((n) => {
          if (!grid[n.y][n.x].revealed && !grid[n.y][n.x].mine) queue.push(n);
        });
      }
    }
  };

  const reveal = (x: number, y: number) => {
    if (exploded || won) return;
    const tile = grid[y][x];
    if (tile.flagged || tile.revealed) return;

    if (firstClick) {
      firstClick = false;
      placeMines(x, y);
    }

    if (tile.mine) {
      exploded = true;
      tile.revealed = true;
      return;
    }

    if (tile.count === 0) floodReveal(x, y);
    else {
      tile.revealed = true;
      revealedCount += 1;
    }

    if (revealedCount === width * height - mineCount) {
      won = true;
      engine.audio.playTone(600, 0.15, 'triangle', 'sfx');
    }
  };

  const toggleFlag = (x: number, y: number) => {
    if (exploded || won) return;
    const tile = grid[y][x];
    if (tile.revealed) return;
    tile.flagged = !tile.flagged;
    flags += tile.flagged ? 1 : -1;
  };

  const chord = (x: number, y: number) => {
    const tile = grid[y][x];
    if (!tile.revealed || tile.count === 0) return;
    const around = neighbors(x, y, width, height);
    const flagged = around.filter((n) => grid[n.y][n.x].flagged).length;
    if (flagged !== tile.count) return;
    around.forEach((n) => {
      if (!grid[n.y][n.x].flagged) reveal(n.x, n.y);
    });
  };

  const aiStep = () => {
    if (exploded || won) return;

    const deterministicMoves: Array<{ x: number; y: number; action: 'reveal' | 'flag' }> = [];

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const tile = grid[y][x];
        if (!tile.revealed || tile.count === 0) continue;
        const around = neighbors(x, y, width, height);
        const hidden = around.filter((n) => !grid[n.y][n.x].revealed && !grid[n.y][n.x].flagged);
        const flagged = around.filter((n) => grid[n.y][n.x].flagged).length;

        if (hidden.length && tile.count === flagged) {
          hidden.forEach((n) => deterministicMoves.push({ x: n.x, y: n.y, action: 'reveal' }));
        }
        if (hidden.length && tile.count - flagged === hidden.length) {
          hidden.forEach((n) => deterministicMoves.push({ x: n.x, y: n.y, action: 'flag' }));
        }
      }
    }

    if (deterministicMoves.length) {
      const move = deterministicMoves[0];
      if (move.action === 'reveal') reveal(move.x, move.y);
      else toggleFlag(move.x, move.y);
      return;
    }

    const unknown: Array<{ x: number; y: number; risk: number }> = [];
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const tile = grid[y][x];
        if (tile.revealed || tile.flagged) continue;

        const adjacentInfo = neighbors(x, y, width, height)
          .filter((n) => grid[n.y][n.x].revealed && grid[n.y][n.x].count > 0)
          .map((n) => {
            const around = neighbors(n.x, n.y, width, height);
            const hidden = around.filter((p) => !grid[p.y][p.x].revealed && !grid[p.y][p.x].flagged).length;
            const flagged = around.filter((p) => grid[p.y][p.x].flagged).length;
            const risk = (grid[n.y][n.x].count - flagged) / Math.max(1, hidden);
            return clamp(risk, 0, 1);
          });

        const risk = adjacentInfo.length
          ? adjacentInfo.reduce((sum, value) => sum + value, 0) / adjacentInfo.length
          : mineCount / (width * height);

        unknown.push({ x, y, risk });
      }
    }

    unknown.sort((a, b) => a.risk - b.risk);
    const safest = unknown[0];
    if (safest) reveal(safest.x, safest.y);
  };

  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'ArrowLeft') cursor.x = Math.max(0, cursor.x - 1);
    if (event.key === 'ArrowRight') cursor.x = Math.min(width - 1, cursor.x + 1);
    if (event.key === 'ArrowUp') cursor.y = Math.max(0, cursor.y - 1);
    if (event.key === 'ArrowDown') cursor.y = Math.min(height - 1, cursor.y + 1);

    if (event.key === ' ' || event.key === 'Enter') reveal(cursor.x, cursor.y);
    if (event.key.toLowerCase() === 'f') toggleFlag(cursor.x, cursor.y);
    if (event.key.toLowerCase() === 'c') chord(cursor.x, cursor.y);
    if (event.key.toLowerCase() === 'r') setup();
    if (event.key.toLowerCase() === '1') {
      difficulty = 'easy';
      setup();
    }
    if (event.key.toLowerCase() === '2') {
      difficulty = 'medium';
      setup();
    }
    if (event.key.toLowerCase() === '3') {
      difficulty = 'hard';
      setup();
    }
  };

  const game = createCanvasGame(canvas, engine, {
    id: 'minesweeper',
    onStart: () => {
      sessionStart = engine.profile.beginSession('minesweeper');
      setup();
      engine.input.setTarget(canvas);

      unsubscribers.push(engine.input.events.on('keydown', onKey));
      unsubscribers.push(
        engine.input.events.on('tap', ({ x, y }) => {
          const boardSize = Math.min(canvas.clientWidth * 0.86, canvas.clientHeight * 0.86);
          const startX = (canvas.clientWidth - boardSize) / 2;
          const startY = (canvas.clientHeight - boardSize) / 2;
          const cell = boardSize / width;
          const col = Math.floor((x - startX) / cell);
          const row = Math.floor((y - startY) / cell);
          if (col >= 0 && col < width && row >= 0 && row < height) {
            cursor = { x: col, y: row };
            reveal(col, row);
          }
        }),
      );
      unsubscribers.push(
        engine.input.events.on('longpress', ({ x, y }) => {
          const boardSize = Math.min(canvas.clientWidth * 0.86, canvas.clientHeight * 0.86);
          const startX = (canvas.clientWidth - boardSize) / 2;
          const startY = (canvas.clientHeight - boardSize) / 2;
          const cell = boardSize / width;
          const col = Math.floor((x - startX) / cell);
          const row = Math.floor((y - startY) / cell);
          if (col >= 0 && col < width && row >= 0 && row < height) {
            toggleFlag(col, row);
          }
        }),
      );

      engine.ai.register(
        'minesweeper',
        {
          tickAI: () => aiStep(),
          onPlayerOverride: () => engine.audio.playTone(150, 0.03, 'sine', 'sfx'),
        },
        { hz: 15 },
      );
      engine.ai.setCurrentGame('minesweeper');
    },
    onStop: () => {
      unsubscribers.splice(0).forEach((u) => u());
      engine.ai.stop('minesweeper');
      engine.ai.unregister('minesweeper');
      engine.profile.endSession(sessionStart);
      engine.profile.setBestScore('minesweeper', revealedCount);
    },
    update: () => {},
    render: (ctx, canvasW, canvasH) => {
      const boardSize = Math.min(canvasW * 0.86, canvasH * 0.86);
      const startX = (canvasW - boardSize) / 2;
      const startY = (canvasH - boardSize) / 2;
      const cell = boardSize / width;

      ctx.fillStyle = '#0f1727';
      ctx.fillRect(0, 0, canvasW, canvasH);

      const textColor = ['#9caece', '#6bc2ff', '#65e08d', '#f7d65e', '#ff8f59', '#f0638c', '#cb7dff', '#ffffff'];

      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const tile = grid[y][x];
          const px = startX + x * cell;
          const py = startY + y * cell;

          ctx.fillStyle = tile.revealed ? '#1e2c44' : '#2d3d5c';
          if (cursor.x === x && cursor.y === y) ctx.fillStyle = '#40618f';
          ctx.fillRect(px + 1, py + 1, cell - 2, cell - 2);

          if (tile.flagged) {
            ctx.fillStyle = '#ff5f7a';
            ctx.fillRect(px + cell * 0.42, py + cell * 0.22, cell * 0.1, cell * 0.56);
            ctx.fillStyle = '#ffe1e8';
            ctx.beginPath();
            ctx.moveTo(px + cell * 0.48, py + cell * 0.22);
            ctx.lineTo(px + cell * 0.76, py + cell * 0.34);
            ctx.lineTo(px + cell * 0.48, py + cell * 0.46);
            ctx.fill();
          }

          if (tile.revealed && tile.mine) {
            ctx.fillStyle = '#ff6a74';
            ctx.beginPath();
            ctx.arc(px + cell / 2, py + cell / 2, cell * 0.24, 0, Math.PI * 2);
            ctx.fill();
          }

          if (tile.revealed && !tile.mine && tile.count > 0) {
            ctx.fillStyle = textColor[tile.count - 1] ?? '#fff';
            ctx.font = `${Math.max(10, cell * 0.44)}px "Space Grotesk", sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(tile.count), px + cell / 2, py + cell / 2 + 1);
          }
        }
      }

      ctx.textAlign = 'left';
      ctx.fillStyle = '#ecf4ff';
      ctx.font = '600 15px "Space Grotesk", sans-serif';
      ctx.fillText(`Difficulty: ${difficulty.toUpperCase()} (1/2/3)`, 16, 24);
      ctx.fillText(`Mines: ${mineCount - flags}`, 16, 44);

      if (exploded || won) {
        ctx.fillStyle = 'rgba(0,0,0,0.56)';
        ctx.fillRect(0, 0, canvasW, canvasH);
        ctx.fillStyle = '#fff';
        ctx.font = '700 30px "Space Grotesk", sans-serif';
        ctx.fillText(won ? 'Board cleared' : 'Mine triggered', canvasW * 0.37, canvasH * 0.45);
      }
    },
    renderTextState: () => ({
      mode: exploded ? 'exploded' : won ? 'won' : 'running',
      coordinates: 'origin top-left, +x right, +y down',
      game: 'minesweeper',
      difficulty,
      cursor,
      minesLeft: mineCount - flags,
      grid: grid.map((row) => row.map((tile) => ({ mine: tile.mine, revealed: tile.revealed, flagged: tile.flagged, count: tile.count }))),
    }),
    startAI: () => {
      engine.ai.start('minesweeper');
      engine.achievements.unlock('ai_observer');
    },
    stopAI: () => engine.ai.stop('minesweeper'),
  });

  return game;
}

import type { EngineContext, GameHandle } from '@/engine/Scene';
import { createCanvasGame } from '@/games/common/canvasGame';
import { randInt } from '@/utils/math';

type Grid = number[][];

interface CellPos {
  x: number;
  y: number;
}

function cloneGrid(grid: Grid): Grid {
  return grid.map((row) => [...row]);
}

function isValid(grid: Grid, row: number, col: number, value: number): boolean {
  for (let i = 0; i < 9; i += 1) {
    if (grid[row][i] === value) return false;
    if (grid[i][col] === value) return false;
  }

  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let y = 0; y < 3; y += 1) {
    for (let x = 0; x < 3; x += 1) {
      if (grid[boxRow + y][boxCol + x] === value) return false;
    }
  }

  return true;
}

function candidates(grid: Grid, row: number, col: number): number[] {
  if (grid[row][col] !== 0) return [];
  const list: number[] = [];
  for (let value = 1; value <= 9; value += 1) {
    if (isValid(grid, row, col, value)) list.push(value);
  }
  return list;
}

function solveBacktracking(grid: Grid): Grid | null {
  let best: { row: number; col: number; options: number[] } | null = null;

  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      if (grid[row][col] !== 0) continue;
      const options = candidates(grid, row, col);
      if (options.length === 0) return null;
      if (!best || options.length < best.options.length) {
        best = { row, col, options };
      }
    }
  }

  if (!best) return grid;

  for (const value of best.options) {
    const next = cloneGrid(grid);
    next[best.row][best.col] = value;
    const solved = solveBacktracking(next);
    if (solved) return solved;
  }

  return null;
}

function humanEliminationStep(grid: Grid): { next: Grid; changed: boolean } {
  const next = cloneGrid(grid);
  let changed = false;

  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      if (next[row][col] !== 0) continue;
      const opts = candidates(next, row, col);
      if (opts.length === 1) {
        next[row][col] = opts[0];
        changed = true;
      }
    }
  }

  return { next, changed };
}

function generateSolvedGrid(): Grid {
  const base = [
    [1, 2, 3, 4, 5, 6, 7, 8, 9],
    [4, 5, 6, 7, 8, 9, 1, 2, 3],
    [7, 8, 9, 1, 2, 3, 4, 5, 6],
    [2, 3, 4, 5, 6, 7, 8, 9, 1],
    [5, 6, 7, 8, 9, 1, 2, 3, 4],
    [8, 9, 1, 2, 3, 4, 5, 6, 7],
    [3, 4, 5, 6, 7, 8, 9, 1, 2],
    [6, 7, 8, 9, 1, 2, 3, 4, 5],
    [9, 1, 2, 3, 4, 5, 6, 7, 8],
  ];

  for (let i = 0; i < 20; i += 1) {
    const a = randInt(0, 8);
    const b = randInt(0, 8);
    [base[a], base[b]] = [base[b], base[a]];
  }

  return base;
}

function generatePuzzle(removals: number): { puzzle: Grid; solution: Grid } {
  const solution = generateSolvedGrid();
  const puzzle = cloneGrid(solution);

  let removed = 0;
  while (removed < removals) {
    const row = randInt(0, 8);
    const col = randInt(0, 8);
    if (puzzle[row][col] === 0) continue;
    puzzle[row][col] = 0;
    removed += 1;
  }

  return { puzzle, solution };
}

export function createGame(canvas: HTMLCanvasElement, engine: EngineContext): GameHandle {
  let puzzle: Grid = createEmpty();
  let solution: Grid = createEmpty();
  let selected: CellPos = { x: 0, y: 0 };
  let notes: Record<string, number[]> = {};
  let mistakes = 0;
  let difficulty = 'medium';
  let completed = false;
  let sessionStart = 0;

  const unsubscribers: Array<() => void> = [];

  function createEmpty(): Grid {
    return Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => 0));
  }

  const recomputeDifficulty = () => {
    const blanks = puzzle.flat().filter((v) => v === 0).length;
    const branch = Math.max(1, blanks / 10 + mistakes * 0.5);
    difficulty = branch > 6 ? 'hard' : branch > 3 ? 'medium' : 'easy';
  };

  const reset = () => {
    const generated = generatePuzzle(44);
    puzzle = generated.puzzle;
    solution = generated.solution;
    selected = { x: 0, y: 0 };
    notes = {};
    mistakes = 0;
    completed = false;
    recomputeDifficulty();
  };

  const fillCell = (value: number) => {
    if (completed) return;
    const row = selected.y;
    const col = selected.x;
    if (solution[row][col] === puzzle[row][col] && puzzle[row][col] !== 0) return;

    if (value === 0) {
      puzzle[row][col] = 0;
      return;
    }

    if (solution[row][col] === value) {
      puzzle[row][col] = value;
      delete notes[`${row},${col}`];
      engine.audio.playTone(420, 0.03, 'triangle', 'sfx');
    } else {
      mistakes += 1;
      engine.audio.playTone(180, 0.08, 'sawtooth', 'sfx');
    }

    completed = puzzle.flat().every((v, idx) => {
      const y = Math.floor(idx / 9);
      const x = idx % 9;
      return v === solution[y][x];
    });
    recomputeDifficulty();
  };

  const toggleNote = (value: number) => {
    const id = `${selected.y},${selected.x}`;
    const set = new Set(notes[id] ?? []);
    if (set.has(value)) set.delete(value);
    else set.add(value);
    notes[id] = Array.from(set).sort((a, b) => a - b);
  };

  const hint = () => {
    const row = selected.y;
    const col = selected.x;
    if (puzzle[row][col] !== 0) return;
    puzzle[row][col] = solution[row][col];
    engine.audio.playTone(500, 0.05, 'sine', 'sfx');
  };

  const aiStep = () => {
    if (completed) return;
    const eliminate = humanEliminationStep(puzzle);
    if (eliminate.changed) {
      puzzle = eliminate.next;
      return;
    }

    const solved = solveBacktracking(cloneGrid(puzzle));
    if (!solved) return;

    for (let row = 0; row < 9; row += 1) {
      for (let col = 0; col < 9; col += 1) {
        if (puzzle[row][col] === 0) {
          puzzle[row][col] = solved[row][col];
          return;
        }
      }
    }
  };

  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'ArrowLeft') selected.x = Math.max(0, selected.x - 1);
    if (event.key === 'ArrowRight') selected.x = Math.min(8, selected.x + 1);
    if (event.key === 'ArrowUp') selected.y = Math.max(0, selected.y - 1);
    if (event.key === 'ArrowDown') selected.y = Math.min(8, selected.y + 1);

    if (/^[1-9]$/.test(event.key)) {
      if (event.shiftKey) toggleNote(Number(event.key));
      else fillCell(Number(event.key));
    }

    if (event.key === '0' || event.key === 'Backspace' || event.key === 'Delete') fillCell(0);
    if (event.key.toLowerCase() === 'h') hint();
    if (event.key.toLowerCase() === 'r') reset();
  };

  const game = createCanvasGame(canvas, engine, {
    id: 'sudoku',
    onStart: () => {
      sessionStart = engine.profile.beginSession('sudoku');
      reset();
      engine.input.setTarget(canvas);

      unsubscribers.push(engine.input.events.on('keydown', onKey));
      unsubscribers.push(
        engine.input.events.on('tap', ({ x, y }) => {
          const boardSize = Math.min(canvas.clientWidth, canvas.clientHeight) * 0.82;
          const startX = (canvas.clientWidth - boardSize) / 2;
          const startY = (canvas.clientHeight - boardSize) / 2;
          const cell = boardSize / 9;
          const col = Math.floor((x - startX) / cell);
          const row = Math.floor((y - startY) / cell);
          if (col >= 0 && col < 9 && row >= 0 && row < 9) {
            selected = { x: col, y: row };
          }
        }),
      );

      engine.ai.register(
        'sudoku',
        {
          tickAI: () => aiStep(),
          onPlayerOverride: () => engine.audio.playTone(150, 0.04, 'square', 'sfx'),
        },
        { hz: 20 },
      );
      engine.ai.setCurrentGame('sudoku');
    },
    onStop: () => {
      unsubscribers.splice(0).forEach((u) => u());
      engine.ai.stop('sudoku');
      engine.ai.unregister('sudoku');
      engine.profile.endSession(sessionStart);
      const filled = puzzle.flat().filter((v) => v !== 0).length;
      engine.profile.setBestScore('sudoku', filled - mistakes);
    },
    update: () => {
      completed = puzzle.flat().every((v, idx) => {
        const row = Math.floor(idx / 9);
        const col = idx % 9;
        return v === solution[row][col];
      });
    },
    render: (ctx, width, height) => {
      const boardSize = Math.min(width, height) * 0.82;
      const startX = (width - boardSize) / 2;
      const startY = (height - boardSize) / 2;
      const cell = boardSize / 9;

      ctx.fillStyle = '#0f1727';
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = 'rgba(95,170,255,0.18)';
      ctx.fillRect(startX + selected.x * cell, startY + selected.y * cell, cell, cell);

      for (let i = 0; i <= 9; i += 1) {
        ctx.strokeStyle = i % 3 === 0 ? '#8db9ff' : 'rgba(255,255,255,0.2)';
        ctx.lineWidth = i % 3 === 0 ? 2 : 1;

        ctx.beginPath();
        ctx.moveTo(startX + i * cell, startY);
        ctx.lineTo(startX + i * cell, startY + boardSize);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(startX, startY + i * cell);
        ctx.lineTo(startX + boardSize, startY + i * cell);
        ctx.stroke();
      }

      for (let row = 0; row < 9; row += 1) {
        for (let col = 0; col < 9; col += 1) {
          const value = puzzle[row][col];
          if (value !== 0) {
            ctx.fillStyle = '#eef4ff';
            ctx.font = '600 24px "Space Grotesk", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(value), startX + col * cell + cell / 2, startY + row * cell + cell / 2);
          } else {
            const id = `${row},${col}`;
            const marks = notes[id] ?? candidates(puzzle, row, col);
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.font = '500 10px "Space Grotesk", sans-serif';
            marks.forEach((value, index) => {
              const sx = index % 3;
              const sy = Math.floor(index / 3);
              ctx.fillText(
                String(value),
                startX + col * cell + 10 + sx * 12,
                startY + row * cell + 12 + sy * 12,
              );
            });
          }
        }
      }

      ctx.textAlign = 'left';
      ctx.fillStyle = '#eef5ff';
      ctx.font = '600 16px "Space Grotesk", sans-serif';
      ctx.fillText(`Difficulty: ${difficulty}`, 24, 28);
      ctx.fillText(`Mistakes: ${mistakes}`, 24, 52);
      ctx.fillText('H for hint, Shift+Number for pencil marks', 24, height - 24);

      if (completed) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#fff';
        ctx.font = '700 28px "Space Grotesk", sans-serif';
        ctx.fillText('Sudoku solved', width * 0.41, height * 0.45);
      }
    },
    renderTextState: () => ({
      mode: completed ? 'completed' : 'running',
      coordinates: 'origin top-left, +x right, +y down',
      game: 'sudoku',
      grid: puzzle,
      selected,
      mistakes,
      difficulty,
      notes,
    }),
    startAI: () => {
      engine.ai.start('sudoku');
      engine.achievements.unlock('ai_observer');
    },
    stopAI: () => engine.ai.stop('sudoku'),
  });

  return game;
}

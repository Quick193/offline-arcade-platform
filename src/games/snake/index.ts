import type { EngineContext, GameHandle } from '@/engine/Scene';
import { createCanvasGame } from '@/games/common/canvasGame';
import { chance, randInt } from '@/utils/math';

interface Cell {
  x: number;
  y: number;
}

type Direction = 'up' | 'down' | 'left' | 'right';
type PowerType = 'speed' | 'slow' | 'invincible' | 'shrink' | 'double';

interface Powerup {
  pos: Cell;
  type: PowerType;
}

const GRID_W = 28;
const GRID_H = 18;

const DIRS: Record<Direction, Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

function equals(a: Cell, b: Cell): boolean {
  return a.x === b.x && a.y === b.y;
}

function key(cell: Cell): string {
  return `${cell.x},${cell.y}`;
}

export function createGame(canvas: HTMLCanvasElement, engine: EngineContext): GameHandle {
  let snake: Cell[] = [];
  let direction: Direction = 'right';
  let nextDirection: Direction = 'right';
  let food: Cell = { x: 10, y: 10 };
  let powerups: Powerup[] = [];
  let obstacles = new Set<string>();
  let score = 0;
  let speed = 6;
  let moveTimer = 0;
  let invincible = 0;
  let doublePoints = 0;
  let shrinkTimer = 22;
  let bounds = { minX: 0, minY: 0, maxX: GRID_W - 1, maxY: GRID_H - 1 };
  let dead = false;
  let sessionStart = 0;

  const unsubscribers: Array<() => void> = [];

  const withinBounds = (cell: Cell): boolean =>
    cell.x >= bounds.minX && cell.x <= bounds.maxX && cell.y >= bounds.minY && cell.y <= bounds.maxY;

  const wrap = (cell: Cell): Cell => {
    const width = bounds.maxX - bounds.minX + 1;
    const height = bounds.maxY - bounds.minY + 1;
    return {
      x: ((cell.x - bounds.minX + width) % width) + bounds.minX,
      y: ((cell.y - bounds.minY + height) % height) + bounds.minY,
    };
  };

  const occupied = (): Set<string> => {
    const set = new Set<string>();
    snake.forEach((segment) => set.add(key(segment)));
    obstacles.forEach((item) => set.add(item));
    return set;
  };

  const spawnFood = () => {
    const used = occupied();
    let tries = 0;
    while (tries < 400) {
      tries += 1;
      const candidate = {
        x: randInt(bounds.minX, bounds.maxX),
        y: randInt(bounds.minY, bounds.maxY),
      };
      if (!used.has(key(candidate))) {
        food = candidate;
        return;
      }
    }
    food = { x: bounds.minX, y: bounds.minY };
  };

  const spawnPowerup = () => {
    if (!chance(0.32)) return;
    const types: PowerType[] = ['speed', 'slow', 'invincible', 'shrink', 'double'];
    const type = types[randInt(0, types.length - 1)];
    powerups.push({
      pos: { x: randInt(bounds.minX, bounds.maxX), y: randInt(bounds.minY, bounds.maxY) },
      type,
    });
  };

  const spawnObstacles = () => {
    obstacles = new Set();
    const count = 12;
    const used = occupied();
    for (let i = 0; i < count; i += 1) {
      let candidate: Cell = { x: 0, y: 0 };
      do {
        candidate = {
          x: randInt(bounds.minX, bounds.maxX),
          y: randInt(bounds.minY, bounds.maxY),
        };
      } while (used.has(key(candidate)) || equals(candidate, food));
      obstacles.add(key(candidate));
    }
  };

  const reset = () => {
    snake = [
      { x: 8, y: 9 },
      { x: 7, y: 9 },
      { x: 6, y: 9 },
    ];
    direction = 'right';
    nextDirection = 'right';
    score = 0;
    speed = 6;
    moveTimer = 0;
    invincible = 0;
    doublePoints = 0;
    shrinkTimer = 22;
    dead = false;
    powerups = [];
    bounds = { minX: 0, minY: 0, maxX: GRID_W - 1, maxY: GRID_H - 1 };
    spawnFood();
    spawnObstacles();
  };

  const applyPowerup = (type: PowerType) => {
    if (type === 'speed') speed += 1.5;
    if (type === 'slow') speed = Math.max(4, speed - 1.2);
    if (type === 'invincible') invincible = 8;
    if (type === 'double') doublePoints = 10;
    if (type === 'shrink' && snake.length > 4) {
      snake = snake.slice(0, Math.ceil(snake.length * 0.66));
    }
  };

  const updateBounds = () => {
    shrinkTimer -= 1;
    if (shrinkTimer > 0) return;
    shrinkTimer = Math.max(8, 22 - Math.floor(score / 12));
    if (bounds.maxX - bounds.minX > 10 && bounds.maxY - bounds.minY > 8) {
      bounds = {
        minX: bounds.minX + 1,
        minY: bounds.minY + 1,
        maxX: bounds.maxX - 1,
        maxY: bounds.maxY - 1,
      };
      snake = snake.map((segment) => wrap(segment));
    }
  };

  const setDirection = (candidate: Direction) => {
    if (candidate === 'up' && direction === 'down') return;
    if (candidate === 'down' && direction === 'up') return;
    if (candidate === 'left' && direction === 'right') return;
    if (candidate === 'right' && direction === 'left') return;
    nextDirection = candidate;
  };

  const move = () => {
    direction = nextDirection;
    const vec = DIRS[direction];
    const head = snake[0];
    const next = wrap({ x: head.x + vec.x, y: head.y + vec.y });

    const hitsSelf = snake.some((segment, index) => index < snake.length - 1 && equals(segment, next));
    const hitsObstacle = obstacles.has(key(next));

    if ((!withinBounds(next) || hitsSelf || hitsObstacle) && invincible <= 0) {
      dead = true;
      return;
    }

    snake.unshift(next);

    const foodEaten = equals(next, food);
    if (foodEaten) {
      score += doublePoints > 0 ? 2 : 1;
      speed = Math.min(16, 6 + score * 0.26);
      spawnFood();
      spawnPowerup();
      if (score % 4 === 0) {
        updateBounds();
      }
      engine.audio.playTone(370, 0.06, 'triangle', 'sfx');
    } else {
      snake.pop();
    }

    const powerIndex = powerups.findIndex((item) => equals(item.pos, next));
    if (powerIndex >= 0) {
      applyPowerup(powerups[powerIndex].type);
      powerups.splice(powerIndex, 1);
      engine.particles.emitBurst(next.x * 14 + 10, next.y * 14 + 10, '#3cf7ff', 14);
    }
  };

  const neighbors = (node: Cell): Cell[] => {
    const out: Cell[] = [];
    (Object.keys(DIRS) as Direction[]).forEach((dir) => {
      const vec = DIRS[dir];
      const next = wrap({ x: node.x + vec.x, y: node.y + vec.y });
      if (!withinBounds(next)) return;
      out.push(next);
    });
    return out;
  };

  const bfsDirectionToFood = (): Direction | null => {
    const queue: Cell[] = [snake[0]];
    const parent = new Map<string, Cell | null>();
    const visited = new Set<string>();
    const blocked = occupied();

    const tail = snake[snake.length - 1];
    blocked.delete(key(tail));

    visited.add(key(snake[0]));
    parent.set(key(snake[0]), null);

    while (queue.length) {
      const current = queue.shift()!;
      if (equals(current, food)) break;
      neighbors(current).forEach((next) => {
        const id = key(next);
        if (visited.has(id)) return;
        if (blocked.has(id)) return;
        visited.add(id);
        parent.set(id, current);
        queue.push(next);
      });
    }

    if (!parent.has(key(food))) return null;

    let cursor: Cell = food;
    let prev: Cell | null = null;
    while (true) {
      const p = parent.get(key(cursor)) ?? null;
      if (!p) {
        prev = cursor;
        break;
      }
      if (equals(p, snake[0])) {
        prev = cursor;
        break;
      }
      cursor = p;
    }

    if (!prev) return null;
    const dx = prev.x - snake[0].x;
    const dy = prev.y - snake[0].y;

    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 || dx < -1 ? 'right' : 'left';
    }

    return dy > 0 || dy < -1 ? 'down' : 'up';
  };

  const survivalDirection = (): Direction => {
    const options = (Object.keys(DIRS) as Direction[]).map((dir) => {
      const vec = DIRS[dir];
      const candidate = wrap({ x: snake[0].x + vec.x, y: snake[0].y + vec.y });
      const bad = obstacles.has(key(candidate)) || snake.some((segment, i) => i < snake.length - 1 && equals(segment, candidate));
      if (bad && invincible <= 0) return { dir, score: -Infinity };

      const seen = new Set<string>();
      const queue = [candidate];
      let openness = 0;
      while (queue.length && openness < 90) {
        const node = queue.shift()!;
        const id = key(node);
        if (seen.has(id)) continue;
        if (obstacles.has(id)) continue;
        if (snake.some((segment, i) => i < snake.length - 2 && equals(segment, node))) continue;
        seen.add(id);
        openness += 1;
        neighbors(node).forEach((n) => {
          if (!seen.has(key(n))) queue.push(n);
        });
      }

      return { dir, score: openness };
    });

    options.sort((a, b) => b.score - a.score);
    return options[0]?.dir ?? direction;
  };

  const aiStep = () => {
    if (dead) return;
    const route = bfsDirectionToFood();
    setDirection(route ?? survivalDirection());
  };

  const game = createCanvasGame(canvas, engine, {
    id: 'snake',
    onStart: () => {
      reset();
      sessionStart = engine.profile.beginSession('snake');
      engine.achievements.unlock('first_game');
      engine.input.setTarget(canvas);
      unsubscribers.push(
        engine.input.events.on('keydown', (event) => {
          if (event.key === 'ArrowUp' || event.key.toLowerCase() === 'w') setDirection('up');
          if (event.key === 'ArrowDown' || event.key.toLowerCase() === 's') setDirection('down');
          if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') setDirection('left');
          if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') setDirection('right');
          if (dead && event.key.toLowerCase() === 'r') reset();
        }),
      );
      unsubscribers.push(
        engine.input.events.on('swipe', (swipe) => {
          if (swipe.direction === 'up') setDirection('up');
          if (swipe.direction === 'down') setDirection('down');
          if (swipe.direction === 'left') setDirection('left');
          if (swipe.direction === 'right') setDirection('right');
        }),
      );

      engine.ai.register(
        'snake',
        {
          tickAI: () => aiStep(),
          onPlayerOverride: () => {
            engine.audio.playTone(190, 0.05, 'square', 'sfx');
          },
        },
        { hz: 24 },
      );
      engine.ai.setCurrentGame('snake');
    },
    onStop: () => {
      unsubscribers.splice(0).forEach((unsub) => unsub());
      engine.ai.stop('snake');
      engine.ai.unregister('snake');
      engine.profile.endSession(sessionStart);
      engine.profile.setBestScore('snake', score);
    },
    update: (deltaTime) => {
      if (dead) return;
      moveTimer += deltaTime;
      if (invincible > 0) invincible -= deltaTime;
      if (doublePoints > 0) doublePoints -= deltaTime;

      const tick = 1 / speed;
      if (moveTimer >= tick) {
        moveTimer -= tick;
        move();
      }
    },
    render: (ctx, width, height) => {
      const cellW = width / GRID_W;
      const cellH = height / GRID_H;

      ctx.fillStyle = '#0a0f17';
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.strokeRect(bounds.minX * cellW, bounds.minY * cellH, (bounds.maxX - bounds.minX + 1) * cellW, (bounds.maxY - bounds.minY + 1) * cellH);

      obstacles.forEach((value) => {
        const [x, y] = value.split(',').map(Number);
        ctx.fillStyle = '#35435f';
        ctx.fillRect(x * cellW + 1, y * cellH + 1, cellW - 2, cellH - 2);
      });

      ctx.fillStyle = '#ff556f';
      ctx.beginPath();
      ctx.arc(food.x * cellW + cellW / 2, food.y * cellH + cellH / 2, Math.min(cellW, cellH) * 0.35, 0, Math.PI * 2);
      ctx.fill();

      powerups.forEach((power) => {
        const colorMap: Record<PowerType, string> = {
          speed: '#7ac7ff',
          slow: '#f5b35c',
          invincible: '#f6ff7a',
          shrink: '#b67cff',
          double: '#7aff98',
        };
        ctx.fillStyle = colorMap[power.type];
        ctx.fillRect(power.pos.x * cellW + 3, power.pos.y * cellH + 3, cellW - 6, cellH - 6);
      });

      snake.forEach((segment, index) => {
        const head = index === 0;
        ctx.fillStyle = head ? (invincible > 0 ? '#fff06f' : '#45ff9e') : '#22b374';
        ctx.fillRect(segment.x * cellW + 1, segment.y * cellH + 1, cellW - 2, cellH - 2);
        if (head) {
          ctx.shadowColor = '#5cffb8';
          ctx.shadowBlur = 12;
          ctx.fillRect(segment.x * cellW + 2, segment.y * cellH + 2, cellW - 4, cellH - 4);
          ctx.shadowBlur = 0;
        }
      });

      ctx.fillStyle = '#eaf4ff';
      ctx.font = '600 16px "Space Grotesk", sans-serif';
      ctx.fillText(`Score ${score}`, 12, 24);
      ctx.fillText(`Speed ${speed.toFixed(1)}`, 12, 44);
      if (doublePoints > 0) ctx.fillText('Double points active', 12, 64);

      if (dead) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 26px "Space Grotesk", sans-serif';
        ctx.fillText('Snake crashed', width * 0.35, height * 0.46);
        ctx.font = '500 16px "Space Grotesk", sans-serif';
        ctx.fillText('Press R to restart', width * 0.38, height * 0.53);
      }
    },
    renderTextState: () => ({
      mode: dead ? 'game_over' : 'running',
      coordinates: 'origin top-left, +x right, +y down',
      game: 'snake',
      snake,
      direction,
      food,
      score,
      speed,
      bounds,
      powerups,
      obstacles: Array.from(obstacles),
    }),
    startAI: () => {
      engine.ai.start('snake');
      engine.achievements.unlock('ai_observer');
    },
    stopAI: () => {
      engine.ai.stop('snake');
    },
  });

  return game;
}

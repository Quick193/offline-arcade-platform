import type { EngineContext, GameHandle } from '@/engine/Scene';
import { createCanvasGame } from '@/games/common/canvasGame';
import { randInt } from '@/utils/math';

interface Card {
  id: number;
  symbol: string;
  flipped: boolean;
  matched: boolean;
  anim: number;
}

const SYMBOLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

function shuffle<T>(items: T[]): T[] {
  const clone = [...items];
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = randInt(0, i);
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
}

export function createGame(canvas: HTMLCanvasElement, engine: EngineContext): GameHandle {
  let cards: Card[] = [];
  let selected: number[] = [];
  let attempts = 0;
  let timer = 0;
  let done = false;
  let flipBackTimer = 0;
  let sessionStart = 0;

  const memory = new Map<string, number[]>();
  const unseen = new Set<number>();

  const unsubscribers: Array<() => void> = [];

  const reset = () => {
    const deck = shuffle([...SYMBOLS, ...SYMBOLS]);
    cards = deck.map((symbol, index) => ({
      id: index,
      symbol,
      flipped: false,
      matched: false,
      anim: 0,
    }));
    selected = [];
    attempts = 0;
    timer = 0;
    done = false;
    flipBackTimer = 0;
    memory.clear();
    unseen.clear();
    cards.forEach((card) => unseen.add(card.id));
  };

  const reveal = (index: number) => {
    if (done || flipBackTimer > 0) return;
    const card = cards[index];
    if (!card || card.flipped || card.matched) return;

    card.flipped = true;
    card.anim = 1;
    selected.push(index);
    unseen.delete(index);

    const known = memory.get(card.symbol) ?? [];
    memory.set(card.symbol, Array.from(new Set([...known, index])));

    if (selected.length === 2) {
      attempts += 1;
      const [a, b] = selected;
      if (cards[a].symbol === cards[b].symbol) {
        cards[a].matched = true;
        cards[b].matched = true;
        selected = [];
        engine.audio.playTone(520, 0.06, 'triangle', 'sfx');
      } else {
        flipBackTimer = 0.8;
      }
    }

    done = cards.every((item) => item.matched);
  };

  const aiStep = () => {
    if (done || flipBackTimer > 0 || selected.length >= 2) return;

    for (const [symbol, indexes] of memory.entries()) {
      const hidden = indexes.filter((index) => !cards[index].matched);
      if (hidden.length >= 2) {
        reveal(hidden[0]);
        reveal(hidden[1]);
        return;
      }
    }

    const pool = Array.from(unseen);
    if (pool.length === 0) return;

    const first = pool[randInt(0, pool.length - 1)];
    reveal(first);

    const secondPool = Array.from(unseen).filter((index) => index !== first);
    if (secondPool.length) {
      reveal(secondPool[randInt(0, secondPool.length - 1)]);
    }
  };

  const indexAt = (x: number, y: number, width: number, height: number): number => {
    const cols = 4;
    const rows = 4;
    const boardW = Math.min(width * 0.84, 540);
    const boardH = boardW;
    const startX = (width - boardW) / 2;
    const startY = (height - boardH) / 2;
    const cellW = boardW / cols;
    const cellH = boardH / rows;

    const col = Math.floor((x - startX) / cellW);
    const row = Math.floor((y - startY) / cellH);
    if (col < 0 || col >= cols || row < 0 || row >= rows) return -1;
    return row * cols + col;
  };

  const game = createCanvasGame(canvas, engine, {
    id: 'memory_match',
    onStart: () => {
      sessionStart = engine.profile.beginSession('memory_match');
      reset();
      engine.input.setTarget(canvas);

      unsubscribers.push(
        engine.input.events.on('tap', ({ x, y }) => {
          const index = indexAt(x, y, canvas.clientWidth, canvas.clientHeight);
          if (index >= 0) reveal(index);
        }),
      );
      unsubscribers.push(
        engine.input.events.on('keydown', (event) => {
          if (event.key.toLowerCase() === 'r') reset();
        }),
      );

      engine.ai.register(
        'memory_match',
        {
          tickAI: () => aiStep(),
          onPlayerOverride: () => engine.audio.playTone(120, 0.04, 'square', 'sfx'),
        },
        { hz: 12 },
      );
      engine.ai.setCurrentGame('memory_match');
    },
    onStop: () => {
      unsubscribers.splice(0).forEach((u) => u());
      engine.ai.stop('memory_match');
      engine.ai.unregister('memory_match');
      engine.profile.endSession(sessionStart);
      const score = Math.max(0, 1000 - attempts * 25 - Math.floor(timer) * 3);
      engine.profile.setBestScore('memory_match', score);
    },
    update: (deltaTime) => {
      timer += deltaTime;
      cards.forEach((card) => {
        card.anim = Math.max(0, card.anim - deltaTime * 4);
      });

      if (flipBackTimer > 0) {
        flipBackTimer -= deltaTime;
        if (flipBackTimer <= 0) {
          selected.forEach((index) => {
            cards[index].flipped = false;
          });
          selected = [];
        }
      }

      done = cards.every((item) => item.matched);
    },
    render: (ctx, width, height) => {
      const cols = 4;
      const rows = 4;
      const boardW = Math.min(width * 0.84, 540);
      const boardH = boardW;
      const startX = (width - boardW) / 2;
      const startY = (height - boardH) / 2;
      const cellW = boardW / cols;
      const cellH = boardH / rows;

      ctx.fillStyle = '#0f1727';
      ctx.fillRect(0, 0, width, height);

      cards.forEach((card, index) => {
        const row = Math.floor(index / cols);
        const col = index % cols;
        const px = startX + col * cellW;
        const py = startY + row * cellH;

        const scale = card.flipped || card.matched ? 1 : 0.96 + card.anim * 0.04;
        const cw = cellW - 10;
        const ch = cellH - 10;

        ctx.save();
        ctx.translate(px + cellW / 2, py + cellH / 2);
        ctx.scale(scale, 1);

        ctx.fillStyle = card.flipped || card.matched ? '#2f4f86' : '#1c2a45';
        ctx.fillRect(-cw / 2, -ch / 2, cw, ch);

        if (card.flipped || card.matched) {
          ctx.fillStyle = '#eef4ff';
          ctx.font = '700 30px "Space Grotesk", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(card.symbol, 0, 2);
        } else {
          ctx.fillStyle = '#5f86cf';
          ctx.fillRect(-8, -8, 16, 16);
        }

        ctx.restore();
      });

      ctx.fillStyle = '#ecf4ff';
      ctx.font = '600 16px "Space Grotesk", sans-serif';
      ctx.fillText(`Attempts: ${attempts}`, 18, 26);
      ctx.fillText(`Time: ${timer.toFixed(1)}s`, 18, 48);

      if (done) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#fff';
        ctx.font = '700 30px "Space Grotesk", sans-serif';
        ctx.fillText('All pairs matched', width * 0.35, height * 0.45);
      }
    },
    renderTextState: () => ({
      mode: done ? 'completed' : 'running',
      coordinates: 'origin top-left, +x right, +y down',
      game: 'memory_match',
      cards: cards.map((card) => ({ id: card.id, symbol: card.symbol, flipped: card.flipped, matched: card.matched })),
      attempts,
      timer,
    }),
    startAI: () => {
      engine.ai.start('memory_match');
      engine.achievements.unlock('ai_observer');
    },
    stopAI: () => engine.ai.stop('memory_match'),
  });

  return game;
}

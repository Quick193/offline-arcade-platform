import type { EngineContext, GameHandle } from '@/engine/Scene';
import { createCanvasGame } from '@/games/common/canvasGame';
import { clamp, rand, randInt } from '@/utils/math';

interface Obstacle {
  x: number;
  type: 'spike' | 'wall' | 'portal' | 'bounce';
  width: number;
  height: number;
}

export function createGame(canvas: HTMLCanvasElement, engine: EngineContext): GameHandle {
  let width = 900;
  let height = 506;
  let y = 0;
  let vy = 0;
  let speed = 220;
  let distance = 0;
  let bpm = 132;
  let beat = 0;
  let ended = false;
  let score = 0;
  let sessionStart = 0;
  let obstacles: Obstacle[] = [];

  const ground = () => height - 90;
  const unsubscribers: Array<() => void> = [];

  const reset = () => {
    y = ground();
    vy = 0;
    speed = 220;
    distance = 0;
    beat = 0;
    ended = false;
    score = 0;
    obstacles = [];
    for (let i = 0; i < 24; i += 1) {
      obstacles.push(genObstacle(width + i * 180));
    }
  };

  const genObstacle = (x: number): Obstacle => {
    const roll = randInt(0, 100);
    if (roll < 35) return { x, type: 'spike', width: 24, height: 28 };
    if (roll < 60) return { x, type: 'wall', width: 30, height: rand(38, 70) } as Obstacle;
    if (roll < 80) return { x, type: 'portal', width: 26, height: 52 };
    return { x, type: 'bounce', width: 28, height: 14 };
  };

  const jump = (micro = false) => {
    if (ended) return;
    if (y >= ground() - 4) {
      vy = micro ? -340 : -440;
      engine.audio.playTone(micro ? 410 : 500, 0.05, 'triangle', 'sfx');
    }
  };

  const aiStep = () => {
    if (ended) return;

    const next = obstacles
      .filter((obs) => obs.x + obs.width >= 130)
      .sort((a, b) => a.x - b.x)[0];

    if (!next) return;

    const lead = (next.x - 130) / Math.max(1, speed);
    const needJump = next.type === 'spike' || next.type === 'wall';
    const micro = next.type === 'spike';

    if (needJump && lead < 0.32 && y >= ground() - 1) {
      jump(micro);
    }

    if (next.type === 'portal' && lead < 0.25 && y < ground() - 40) {
      jump(true);
    }
  };

  const game = createCanvasGame(canvas, engine, {
    id: 'neon_blob_dash',
    onStart: () => {
      sessionStart = engine.profile.beginSession('neon_blob_dash');
      reset();
      engine.input.setTarget(canvas);

      unsubscribers.push(
        engine.input.events.on('keydown', (event) => {
          if (event.key === ' ' || event.key === 'ArrowUp') jump();
          if (event.key.toLowerCase() === 'r') reset();
        }),
      );
      unsubscribers.push(engine.input.events.on('tap', () => jump()));

      engine.ai.register(
        'neon_blob_dash',
        {
          tickAI: () => aiStep(),
          onPlayerOverride: () => engine.audio.playTone(180, 0.04, 'square', 'sfx'),
        },
        { hz: 30 },
      );
      engine.ai.setCurrentGame('neon_blob_dash');
    },
    onStop: () => {
      unsubscribers.splice(0).forEach((u) => u());
      engine.ai.stop('neon_blob_dash');
      engine.ai.unregister('neon_blob_dash');
      engine.profile.endSession(sessionStart);
      engine.profile.setBestScore('neon_blob_dash', score);
    },
    onResize: (w, h) => {
      width = w;
      height = h;
      y = ground();
    },
    update: (deltaTime) => {
      if (ended) return;

      beat += deltaTime * (bpm / 60);
      distance += speed * deltaTime;
      score = Math.floor(distance / 10);

      speed += deltaTime * 3.2;
      vy += 920 * deltaTime;
      y = Math.min(ground(), y + vy * deltaTime);
      if (y >= ground()) vy = 0;

      obstacles.forEach((obstacle) => {
        obstacle.x -= speed * deltaTime;
      });

      obstacles.forEach((obstacle) => {
        if (obstacle.x + obstacle.width < 0) {
          obstacle.x = Math.max(...obstacles.map((o) => o.x)) + rand(150, 260);
          Object.assign(obstacle, genObstacle(obstacle.x));
        }

        const playerW = 34;
        const playerH = 34;
        const px = 130;
        const py = y - playerH;
        const ox = obstacle.x;
        const oy = ground() - obstacle.height;

        const collides = px < ox + obstacle.width && px + playerW > ox && py < oy + obstacle.height && py + playerH > oy;
        if (!collides) return;

        if (obstacle.type === 'portal') {
          y = Math.max(ground() - 120, y - 100);
          obstacle.x = -40;
          engine.particles.emitBurst(px, y, '#88e9ff', 18);
          return;
        }

        if (obstacle.type === 'bounce') {
          vy = -560;
          obstacle.x = -40;
          return;
        }

        ended = true;
      });
    },
    render: (ctx, w, h) => {
      const pulse = 0.2 + 0.1 * Math.sin(beat * Math.PI * 2);
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#060b1b');
      grad.addColorStop(1, '#101d3b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = `rgba(70,230,255,${0.18 + pulse})`;
      for (let i = 0; i < 10; i += 1) {
        const yLine = h * 0.2 + i * 36;
        ctx.beginPath();
        ctx.moveTo(0, yLine);
        ctx.lineTo(w, yLine);
        ctx.stroke();
      }

      ctx.fillStyle = '#1f2d4f';
      ctx.fillRect(0, ground(), w, h - ground());

      obstacles.forEach((obstacle) => {
        if (obstacle.type === 'spike') {
          ctx.fillStyle = '#ff5f8f';
          ctx.beginPath();
          ctx.moveTo(obstacle.x, ground());
          ctx.lineTo(obstacle.x + obstacle.width / 2, ground() - obstacle.height);
          ctx.lineTo(obstacle.x + obstacle.width, ground());
          ctx.fill();
        }
        if (obstacle.type === 'wall') {
          ctx.fillStyle = '#ff7b4a';
          ctx.fillRect(obstacle.x, ground() - obstacle.height, obstacle.width, obstacle.height);
        }
        if (obstacle.type === 'portal') {
          ctx.strokeStyle = '#83f5ff';
          ctx.lineWidth = 3;
          ctx.strokeRect(obstacle.x, ground() - obstacle.height, obstacle.width, obstacle.height);
        }
        if (obstacle.type === 'bounce') {
          ctx.fillStyle = '#7aff99';
          ctx.fillRect(obstacle.x, ground() - obstacle.height, obstacle.width, obstacle.height);
        }
      });

      const blobY = y - 18;
      ctx.shadowColor = '#5ff7ff';
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#52e6ff';
      ctx.beginPath();
      ctx.arc(130, blobY, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#eaf5ff';
      ctx.font = '600 16px "Space Grotesk", sans-serif';
      ctx.fillText(`Score: ${score}`, 14, 24);
      ctx.fillText(`Speed: ${speed.toFixed(1)}`, 14, 46);
      ctx.fillText(`BPM: ${bpm}`, 14, 68);

      if (ended) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#fff';
        ctx.font = '700 30px "Space Grotesk", sans-serif';
        ctx.fillText('Blob crashed', w * 0.39, h * 0.45);
      }
    },
    renderTextState: () => ({
      mode: ended ? 'game_over' : 'running',
      coordinates: 'origin top-left, +x right, +y down',
      game: 'neon_blob_dash',
      player: { x: 130, y, vy },
      speed,
      bpm,
      score,
      obstacles: obstacles.filter((obs) => obs.x > -50 && obs.x < 350),
    }),
    startAI: () => {
      engine.ai.start('neon_blob_dash');
      engine.achievements.unlock('ai_observer');
    },
    stopAI: () => engine.ai.stop('neon_blob_dash'),
  });

  return game;
}

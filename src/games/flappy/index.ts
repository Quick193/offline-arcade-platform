import type { EngineContext, GameHandle } from '@/engine/Scene';
import { createCanvasGame } from '@/games/common/canvasGame';
import { clamp, rand, randInt } from '@/utils/math';

interface Pipe {
  x: number;
  gapY: number;
  gapSize: number;
  passed: boolean;
}

interface WindZone {
  x: number;
  width: number;
  force: number;
}

const PIPE_SPACING = 230;

export function createGame(canvas: HTMLCanvasElement, engine: EngineContext): GameHandle {
  let birdY = 210;
  let birdV = 0;
  let birdX = 140;
  let gravity = 930;
  let drag = 0.995;
  let dead = false;
  let score = 0;
  let multiplier = 1;
  let pipeSpeed = 180;
  let pipes: Pipe[] = [];
  let windZones: WindZone[] = [];
  let parallax = 0;
  let skin: 'cyan' | 'amber' | 'mint' = 'cyan';
  let trailStyle: 'dots' | 'line' | 'spark' = 'dots';
  let width = 900;
  let height = 506;
  let sessionStart = 0;

  const unsubscribers: Array<() => void> = [];

  const reset = () => {
    birdY = height * 0.45;
    birdV = 0;
    dead = false;
    score = 0;
    multiplier = 1;
    pipeSpeed = 180;
    pipes = [];
    windZones = [];

    for (let i = 0; i < 6; i += 1) {
      pipes.push({
        x: width + i * PIPE_SPACING,
        gapY: rand(120, height - 120),
        gapSize: rand(120, 170),
        passed: false,
      });
    }

    for (let i = 0; i < 4; i += 1) {
      windZones.push({
        x: width + i * 380,
        width: rand(120, 200),
        force: rand(-55, 55),
      });
    }
  };

  const flap = () => {
    if (dead) return;
    birdV = -300;
    engine.audio.playTone(460, 0.05, 'triangle', 'sfx');
  };

  const updateAI = () => {
    if (dead) return;
    const nextPipe = pipes.find((pipe) => pipe.x + 70 >= birdX) ?? pipes[0];
    if (!nextPipe) return;

    const targetY = nextPipe.gapY;
    const timeToPipe = Math.max(0.1, (nextPipe.x - birdX) / pipeSpeed);
    const projectedY = birdY + birdV * timeToPipe + 0.5 * gravity * timeToPipe * timeToPipe;

    const collisionRisk = Math.abs(projectedY - targetY) / (nextPipe.gapSize * 0.5);
    if (collisionRisk > 0.82 || projectedY > targetY + nextPipe.gapSize * 0.18) {
      flap();
    }
  };

  const cycleSkins = () => {
    skin = skin === 'cyan' ? 'amber' : skin === 'amber' ? 'mint' : 'cyan';
    trailStyle = trailStyle === 'dots' ? 'line' : trailStyle === 'line' ? 'spark' : 'dots';
  };

  const game = createCanvasGame(canvas, engine, {
    id: 'flappy',
    onStart: () => {
      sessionStart = engine.profile.beginSession('flappy');
      reset();
      engine.input.setTarget(canvas);
      unsubscribers.push(
        engine.input.events.on('keydown', (event) => {
          if (event.key === ' ' || event.key.toLowerCase() === 'w' || event.key === 'ArrowUp') flap();
          if (event.key.toLowerCase() === 'r') reset();
          if (event.key.toLowerCase() === 'k') cycleSkins();
        }),
      );
      unsubscribers.push(engine.input.events.on('tap', flap));

      engine.ai.register(
        'flappy',
        {
          tickAI: () => updateAI(),
          onPlayerOverride: () => {
            engine.audio.playTone(150, 0.04, 'square', 'sfx');
          },
        },
        { hz: 36 },
      );
      engine.ai.setCurrentGame('flappy');
    },
    onStop: () => {
      unsubscribers.splice(0).forEach((unsub) => unsub());
      engine.ai.stop('flappy');
      engine.ai.unregister('flappy');
      engine.profile.endSession(sessionStart);
      engine.profile.setBestScore('flappy', score);
    },
    onResize: (w, h) => {
      width = w;
      height = h;
      birdX = width * 0.18;
      reset();
    },
    update: (deltaTime) => {
      if (dead) return;

      parallax += pipeSpeed * deltaTime * 0.35;
      birdV += gravity * deltaTime;
      birdV *= drag;
      birdY += birdV * deltaTime;

      const wind = windZones.find((zone) => birdX >= zone.x && birdX <= zone.x + zone.width);
      if (wind) {
        birdX += wind.force * deltaTime;
      }
      birdX = clamp(birdX, 100, width * 0.3);

      pipes.forEach((pipe) => {
        pipe.x -= pipeSpeed * deltaTime;

        if (!pipe.passed && pipe.x + 70 < birdX) {
          pipe.passed = true;
          score += multiplier;
          pipeSpeed += 2;
          multiplier = 1 + Math.floor(score / 10);
        }

        if (pipe.x < -80) {
          pipe.x = Math.max(...pipes.map((item) => item.x)) + PIPE_SPACING;
          pipe.gapY = rand(120, height - 120);
          pipe.gapSize = rand(120, 168);
          pipe.passed = false;
        }
      });

      windZones.forEach((zone) => {
        zone.x -= pipeSpeed * deltaTime;
        if (zone.x + zone.width < 0) {
          zone.x = width + rand(200, 420);
          zone.width = rand(120, 200);
          zone.force = rand(-70, 70);
        }
      });

      if (birdY < 20 || birdY > height - 20) dead = true;

      pipes.forEach((pipe) => {
        const withinX = birdX + 16 > pipe.x && birdX - 16 < pipe.x + 70;
        const top = pipe.gapY - pipe.gapSize / 2;
        const bottom = pipe.gapY + pipe.gapSize / 2;
        const hitsPipe = birdY - 13 < top || birdY + 13 > bottom;
        if (withinX && hitsPipe) dead = true;
      });

      if (dead) {
        engine.audio.playTone(130, 0.3, 'sawtooth', 'sfx');
      }
    },
    render: (ctx, w, h) => {
      const gradient = ctx.createLinearGradient(0, 0, 0, h);
      gradient.addColorStop(0, '#142236');
      gradient.addColorStop(1, '#0a101c');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);

      for (let i = 0; i < 5; i += 1) {
        const x = ((i * 240 - (parallax % 240)) + w) % w;
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(x, h * 0.64, 140, h * 0.36);
      }

      windZones.forEach((zone) => {
        ctx.fillStyle = zone.force >= 0 ? 'rgba(80,190,255,0.08)' : 'rgba(255,160,80,0.08)';
        ctx.fillRect(zone.x, 0, zone.width, h);
      });

      pipes.forEach((pipe) => {
        const top = pipe.gapY - pipe.gapSize / 2;
        const bottom = pipe.gapY + pipe.gapSize / 2;

        ctx.fillStyle = '#2fbe73';
        ctx.fillRect(pipe.x, 0, 70, top);
        ctx.fillRect(pipe.x, bottom, 70, h - bottom);

        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(pipe.x + 70, 0, 8, top);
        ctx.fillRect(pipe.x + 70, bottom, 8, h - bottom);
      });

      const birdColor: Record<typeof skin, string> = {
        cyan: '#5ddfff',
        amber: '#ffcc66',
        mint: '#84ffcc',
      };

      if (trailStyle === 'dots') {
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        for (let i = 0; i < 6; i += 1) {
          ctx.beginPath();
          ctx.arc(birdX - i * 10, birdY + Math.sin(i) * 2, 2 + i * 0.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (trailStyle === 'line') {
        ctx.strokeStyle = 'rgba(255,255,255,0.28)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(birdX - 50, birdY + 8);
        ctx.quadraticCurveTo(birdX - 24, birdY + 4, birdX - 8, birdY);
        ctx.stroke();
      }
      if (trailStyle === 'spark') {
        for (let i = 0; i < 8; i += 1) {
          ctx.fillStyle = `rgba(255,255,255,${0.5 - i * 0.05})`;
          ctx.fillRect(birdX - 6 - i * 7, birdY + rand(-8, 8), 3, 3);
        }
      }

      ctx.fillStyle = birdColor[skin];
      ctx.beginPath();
      ctx.arc(birdX, birdY, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0d1725';
      ctx.beginPath();
      ctx.arc(birdX + 4, birdY - 4, 2.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#eef7ff';
      ctx.font = '700 28px "Space Grotesk", sans-serif';
      ctx.fillText(`${score}`, 18, 44);
      ctx.font = '600 14px "Space Grotesk", sans-serif';
      ctx.fillText(`x${multiplier} multiplier`, 18, 64);

      if (dead) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#fff';
        ctx.font = '700 28px "Space Grotesk", sans-serif';
        ctx.fillText('Flap failed', w * 0.4, h * 0.44);
        ctx.font = '500 16px "Space Grotesk", sans-serif';
        ctx.fillText('Tap or press R to restart', w * 0.37, h * 0.52);
      }
    },
    renderTextState: () => ({
      mode: dead ? 'game_over' : 'running',
      coordinates: 'origin top-left, +x right, +y down',
      game: 'flappy',
      bird: { x: birdX, y: birdY, vy: birdV },
      score,
      multiplier,
      pipes: pipes.map((pipe) => ({ x: pipe.x, gapY: pipe.gapY, gapSize: pipe.gapSize })),
      windZones,
      skin,
      trailStyle,
    }),
    startAI: () => {
      engine.ai.start('flappy');
      engine.achievements.unlock('ai_observer');
    },
    stopAI: () => {
      engine.ai.stop('flappy');
    },
  });

  return game;
}

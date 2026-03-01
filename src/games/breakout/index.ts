import type { EngineContext, GameHandle } from '@/engine/Scene';
import { createCanvasGame } from '@/games/common/canvasGame';
import { clamp, chance, rand, randInt } from '@/utils/math';

interface Brick {
  x: number;
  y: number;
  hp: number;
}

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  piercing: number;
}

interface Powerup {
  x: number;
  y: number;
  type: 'expand' | 'shrink' | 'multi' | 'pierce' | 'laser';
}

export function createGame(canvas: HTMLCanvasElement, engine: EngineContext): GameHandle {
  let width = 900;
  let height = 506;
  let paddleX = 380;
  let paddleW = 120;
  let paddleH = 14;
  let balls: Ball[] = [];
  let bricks: Brick[] = [];
  let powerups: Powerup[] = [];
  let score = 0;
  let lives = 3;
  let laserShots: Array<{ x: number; y: number }> = [];
  let laserReady = 0;
  let sessionStart = 0;
  let lost = false;

  const unsubscribers: Array<() => void> = [];

  const resetLevel = () => {
    bricks = [];
    for (let row = 0; row < 6; row += 1) {
      for (let col = 0; col < 10; col += 1) {
        bricks.push({
          x: 70 + col * 74,
          y: 60 + row * 26,
          hp: row >= 4 ? 2 : 1,
        });
      }
    }

    balls = [
      {
        x: width / 2,
        y: height - 80,
        vx: rand(-170, 170),
        vy: -290,
        piercing: 0,
      },
    ];

    powerups = [];
    laserShots = [];
    paddleW = 120;
    laserReady = 0;
    lost = false;
  };

  const spawnPowerup = (x: number, y: number) => {
    if (!chance(0.28)) return;
    const types: Powerup['type'][] = ['expand', 'shrink', 'multi', 'pierce', 'laser'];
    powerups.push({ x, y, type: types[randInt(0, types.length - 1)] });
  };

  const applyPowerup = (type: Powerup['type']) => {
    if (type === 'expand') paddleW = Math.min(180, paddleW + 26);
    if (type === 'shrink') paddleW = Math.max(70, paddleW - 20);
    if (type === 'multi' && balls.length < 5) {
      const copy = balls.flatMap((ball) => [
        { ...ball, vx: ball.vx * 1.08, vy: -Math.abs(ball.vy), x: ball.x - 8 },
        { ...ball, vx: -ball.vx * 1.02, vy: -Math.abs(ball.vy), x: ball.x + 8 },
      ]);
      balls = copy.slice(0, 5);
    }
    if (type === 'pierce') {
      balls.forEach((ball) => {
        ball.piercing = 6;
      });
    }
    if (type === 'laser') {
      laserReady = 10;
    }

    engine.audio.playTone(540, 0.06, 'triangle', 'sfx');
  };

  const hitBrick = (brick: Brick) => {
    brick.hp -= 1;
    if (brick.hp <= 0) {
      score += 10;
      spawnPowerup(brick.x + 30, brick.y + 12);
      engine.particles.emitBurst(brick.x + 30, brick.y + 12, '#9ed0ff', 16);
    } else {
      score += 4;
    }
  };

  const aiStep = () => {
    if (!balls.length) return;
    const bestBall = balls.reduce((best, ball) => (ball.y > best.y ? ball : best), balls[0]);
    paddleX = clamp(bestBall.x - paddleW / 2, 10, width - paddleW - 10);
  };

  const shootLaser = () => {
    if (laserReady <= 0) return;
    laserReady -= 1;
    laserShots.push({ x: paddleX + paddleW * 0.25, y: height - 36 });
    laserShots.push({ x: paddleX + paddleW * 0.75, y: height - 36 });
    engine.audio.playTone(680, 0.03, 'square', 'sfx');
  };

  const game = createCanvasGame(canvas, engine, {
    id: 'breakout',
    onStart: () => {
      sessionStart = engine.profile.beginSession('breakout');
      score = 0;
      lives = 3;
      resetLevel();
      engine.input.setTarget(canvas);

      unsubscribers.push(
        engine.input.events.on('pointermove', ({ x }) => {
          paddleX = clamp(x - paddleW / 2, 10, width - paddleW - 10);
        }),
      );
      unsubscribers.push(
        engine.input.events.on('keydown', (event) => {
          if (event.key === 'ArrowLeft') paddleX = clamp(paddleX - 32, 10, width - paddleW - 10);
          if (event.key === 'ArrowRight') paddleX = clamp(paddleX + 32, 10, width - paddleW - 10);
          if (event.key.toLowerCase() === 'r') {
            score = 0;
            lives = 3;
            resetLevel();
          }
          if (event.key === ' ') shootLaser();
        }),
      );
      unsubscribers.push(engine.input.events.on('tap', shootLaser));

      engine.ai.register(
        'breakout',
        {
          tickAI: () => aiStep(),
          onPlayerOverride: () => engine.audio.playTone(180, 0.04, 'sine', 'sfx'),
        },
        { hz: 30 },
      );
      engine.ai.setCurrentGame('breakout');
    },
    onStop: () => {
      unsubscribers.splice(0).forEach((u) => u());
      engine.ai.stop('breakout');
      engine.ai.unregister('breakout');
      engine.profile.endSession(sessionStart);
      engine.profile.setBestScore('breakout', score);
    },
    onResize: (w, h) => {
      width = w;
      height = h;
      paddleX = clamp(paddleX, 10, width - paddleW - 10);
    },
    update: (deltaTime) => {
      if (lost) return;

      balls.forEach((ball) => {
        ball.x += ball.vx * deltaTime;
        ball.y += ball.vy * deltaTime;

        if (ball.x < 8 || ball.x > width - 8) {
          ball.vx *= -1;
          ball.x = clamp(ball.x, 8, width - 8);
        }
        if (ball.y < 8) {
          ball.vy *= -1;
          ball.y = 8;
        }

        if (
          ball.y + 8 >= height - 30 - paddleH &&
          ball.y - 8 <= height - 30 &&
          ball.x >= paddleX &&
          ball.x <= paddleX + paddleW &&
          ball.vy > 0
        ) {
          const impact = (ball.x - (paddleX + paddleW / 2)) / (paddleW / 2);
          const speed = Math.min(530, Math.hypot(ball.vx, ball.vy) * 1.03);
          ball.vx = speed * impact;
          ball.vy = -Math.abs(speed * (1 - Math.abs(impact) * 0.35));
        }

        for (const brick of bricks) {
          if (brick.hp <= 0) continue;
          if (ball.x > brick.x && ball.x < brick.x + 68 && ball.y > brick.y && ball.y < brick.y + 20) {
            hitBrick(brick);
            if (ball.piercing > 0) {
              ball.piercing -= 1;
            } else {
              ball.vy *= -1;
              break;
            }
          }
        }
      });

      bricks = bricks.filter((brick) => brick.hp > 0);
      if (!bricks.length) {
        resetLevel();
      }

      balls = balls.filter((ball) => ball.y < height + 24);
      if (!balls.length) {
        lives -= 1;
        if (lives <= 0) {
          lost = true;
        } else {
          balls = [{ x: paddleX + paddleW / 2, y: height - 80, vx: rand(-180, 180), vy: -290, piercing: 0 }];
        }
      }

      powerups.forEach((power) => {
        power.y += 120 * deltaTime;
      });
      powerups = powerups.filter((power) => {
        if (power.y > height + 20) return false;
        if (power.y >= height - 30 && power.x >= paddleX && power.x <= paddleX + paddleW) {
          applyPowerup(power.type);
          return false;
        }
        return true;
      });

      laserShots.forEach((shot) => {
        shot.y -= 430 * deltaTime;
      });
      laserShots = laserShots.filter((shot) => shot.y > 0);

      laserShots.forEach((shot) => {
        for (const brick of bricks) {
          if (brick.hp <= 0) continue;
          if (shot.x > brick.x && shot.x < brick.x + 68 && shot.y > brick.y && shot.y < brick.y + 20) {
            hitBrick(brick);
            shot.y = -10;
            break;
          }
        }
      });
    },
    render: (ctx, w, h) => {
      ctx.fillStyle = '#0d1423';
      ctx.fillRect(0, 0, w, h);

      bricks.forEach((brick) => {
        const shade = brick.hp === 2 ? '#4f88ff' : '#7bb3ff';
        ctx.fillStyle = shade;
        ctx.fillRect(brick.x, brick.y, 68, 20);
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(brick.x + 2, brick.y + 2, 62, 4);
      });

      ctx.fillStyle = '#f0f6ff';
      ctx.fillRect(paddleX, h - 30, paddleW, paddleH);

      balls.forEach((ball) => {
        ctx.fillStyle = ball.piercing > 0 ? '#ffea73' : '#ffffff';
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, 8, 0, Math.PI * 2);
        ctx.fill();
      });

      powerups.forEach((power) => {
        const palette: Record<Powerup['type'], string> = {
          expand: '#6effbe',
          shrink: '#ff7f95',
          multi: '#78a8ff',
          pierce: '#ffe66e',
          laser: '#ff84f1',
        };
        ctx.fillStyle = palette[power.type];
        ctx.fillRect(power.x - 10, power.y - 10, 20, 20);
      });

      ctx.fillStyle = '#ff9cff';
      laserShots.forEach((shot) => {
        ctx.fillRect(shot.x - 2, shot.y - 8, 4, 12);
      });

      ctx.fillStyle = '#edf5ff';
      ctx.font = '600 16px "Space Grotesk", sans-serif';
      ctx.fillText(`Score: ${score}`, 16, 26);
      ctx.fillText(`Lives: ${lives}`, 16, 48);
      ctx.fillText(`Laser: ${laserReady}`, 16, 70);

      if (lost) {
        ctx.fillStyle = 'rgba(0,0,0,0.58)';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#fff';
        ctx.font = '700 30px "Space Grotesk", sans-serif';
        ctx.fillText('Breakout failed', w * 0.38, h * 0.45);
      }
    },
    renderTextState: () => ({
      mode: lost ? 'game_over' : 'running',
      coordinates: 'origin top-left, +x right, +y down',
      game: 'breakout',
      paddle: { x: paddleX, width: paddleW },
      balls: balls.map((ball) => ({ x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy, piercing: ball.piercing })),
      bricks: bricks.length,
      score,
      lives,
      powerups,
    }),
    startAI: () => {
      engine.ai.start('breakout');
      engine.achievements.unlock('ai_observer');
    },
    stopAI: () => engine.ai.stop('breakout'),
  });

  return game;
}

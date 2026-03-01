import type { EngineContext, GameHandle } from '@/engine/Scene';
import { createCanvasGame } from '@/games/common/canvasGame';
import { angleToVec, clamp, distance, rand } from '@/utils/math';

interface Asteroid {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

interface Ufo {
  x: number;
  y: number;
  vx: number;
  cooldown: number;
}

export function createGame(canvas: HTMLCanvasElement, engine: EngineContext): GameHandle {
  let width = 900;
  let height = 506;

  let ship = { x: width / 2, y: height / 2, vx: 0, vy: 0, angle: -Math.PI / 2 };
  let bullets: Bullet[] = [];
  let asteroids: Asteroid[] = [];
  let ufo: Ufo | null = null;
  let score = 0;
  let lives = 3;
  let ended = false;
  let shootCooldown = 0;
  let sessionStart = 0;

  const unsubscribers: Array<() => void> = [];

  const wrap = (value: number, max: number): number => {
    if (value < 0) return value + max;
    if (value > max) return value - max;
    return value;
  };

  const spawnWave = (count = 5) => {
    for (let i = 0; i < count; i += 1) {
      asteroids.push({
        x: rand(0, width),
        y: rand(0, height),
        vx: rand(-70, 70),
        vy: rand(-70, 70),
        size: rand(26, 48),
      });
    }
  };

  const reset = () => {
    ship = { x: width / 2, y: height / 2, vx: 0, vy: 0, angle: -Math.PI / 2 };
    bullets = [];
    asteroids = [];
    spawnWave();
    ufo = null;
    score = 0;
    lives = 3;
    ended = false;
    shootCooldown = 0;
  };

  const shoot = () => {
    if (shootCooldown > 0 || ended) return;
    shootCooldown = 0.14;
    const dir = angleToVec(ship.angle);
    bullets.push({
      x: ship.x + dir.x * 16,
      y: ship.y + dir.y * 16,
      vx: ship.vx + dir.x * 380,
      vy: ship.vy + dir.y * 380,
      life: 1.6,
    });
    engine.audio.playTone(620, 0.03, 'square', 'sfx');
  };

  const splitAsteroid = (asteroid: Asteroid) => {
    if (asteroid.size < 22) return;
    const nextSize = asteroid.size * 0.62;
    asteroids.push(
      {
        x: asteroid.x,
        y: asteroid.y,
        vx: asteroid.vx + rand(-45, 45),
        vy: asteroid.vy + rand(-45, 45),
        size: nextSize,
      },
      {
        x: asteroid.x,
        y: asteroid.y,
        vx: asteroid.vx + rand(-45, 45),
        vy: asteroid.vy + rand(-45, 45),
        size: nextSize,
      },
    );
  };

  const aiStep = () => {
    if (ended) return;

    const nearest = asteroids.reduce<Asteroid | null>((best, asteroid) => {
      if (!best) return asteroid;
      return distance({ x: ship.x, y: ship.y }, { x: asteroid.x, y: asteroid.y }) <
        distance({ x: ship.x, y: ship.y }, { x: best.x, y: best.y })
        ? asteroid
        : best;
    }, null);

    if (!nearest) return;

    const dx = nearest.x - ship.x;
    const dy = nearest.y - ship.y;
    const futureX = nearest.x + nearest.vx * 0.5;
    const futureY = nearest.y + nearest.vy * 0.5;

    const targetAngle = Math.atan2(futureY - ship.y, futureX - ship.x);
    let delta = targetAngle - ship.angle;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;

    ship.angle += clamp(delta, -0.1, 0.1);

    const collisionCone = Math.abs(Math.atan2(dy, dx) - ship.angle);
    if (Math.abs(dx) < nearest.size + 90 && Math.abs(dy) < nearest.size + 90 && collisionCone < 1.1) {
      const away = angleToVec(ship.angle + Math.PI / 2);
      ship.vx += away.x * 22;
      ship.vy += away.y * 22;
    }

    if (Math.abs(delta) < 0.2 && Math.hypot(dx, dy) < 320) {
      shoot();
    }
  };

  const game = createCanvasGame(canvas, engine, {
    id: 'asteroids',
    onStart: () => {
      sessionStart = engine.profile.beginSession('asteroids');
      reset();
      engine.input.setTarget(canvas);

      unsubscribers.push(
        engine.input.events.on('keydown', (event) => {
          if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') ship.angle -= 0.18;
          if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') ship.angle += 0.18;
          if (event.key === 'ArrowUp' || event.key.toLowerCase() === 'w') {
            const thrust = angleToVec(ship.angle);
            ship.vx += thrust.x * 18;
            ship.vy += thrust.y * 18;
            engine.particles.emitBurst(ship.x - thrust.x * 8, ship.y - thrust.y * 8, '#9fdcff', 6);
          }
          if (event.key === ' ') shoot();
          if (event.key.toLowerCase() === 'r') reset();
        }),
      );
      unsubscribers.push(
        engine.input.events.on('tap', () => {
          shoot();
        }),
      );
      unsubscribers.push(
        engine.input.events.on('swipe', (swipe) => {
          if (swipe.direction === 'left') ship.angle -= 0.22;
          if (swipe.direction === 'right') ship.angle += 0.22;
          if (swipe.direction === 'up') {
            const thrust = angleToVec(ship.angle);
            ship.vx += thrust.x * 20;
            ship.vy += thrust.y * 20;
          }
        }),
      );

      engine.ai.register(
        'asteroids',
        {
          tickAI: () => aiStep(),
          onPlayerOverride: () => engine.audio.playTone(150, 0.03, 'sine', 'sfx'),
        },
        { hz: 35 },
      );
      engine.ai.setCurrentGame('asteroids');
    },
    onStop: () => {
      unsubscribers.splice(0).forEach((u) => u());
      engine.ai.stop('asteroids');
      engine.ai.unregister('asteroids');
      engine.profile.endSession(sessionStart);
      engine.profile.setBestScore('asteroids', score);
    },
    onResize: (w, h) => {
      width = w;
      height = h;
      ship.x = clamp(ship.x, 0, width);
      ship.y = clamp(ship.y, 0, height);
    },
    update: (deltaTime) => {
      if (ended) return;
      shootCooldown = Math.max(0, shootCooldown - deltaTime);

      ship.vx *= 0.992;
      ship.vy *= 0.992;
      ship.x = wrap(ship.x + ship.vx * deltaTime, width);
      ship.y = wrap(ship.y + ship.vy * deltaTime, height);

      bullets.forEach((bullet) => {
        bullet.x = wrap(bullet.x + bullet.vx * deltaTime, width);
        bullet.y = wrap(bullet.y + bullet.vy * deltaTime, height);
        bullet.life -= deltaTime;
      });
      bullets = bullets.filter((bullet) => bullet.life > 0);

      asteroids.forEach((asteroid) => {
        asteroid.x = wrap(asteroid.x + asteroid.vx * deltaTime, width);
        asteroid.y = wrap(asteroid.y + asteroid.vy * deltaTime, height);
      });

      bullets.forEach((bullet) => {
        asteroids.forEach((asteroid) => {
          if (distance({ x: bullet.x, y: bullet.y }, { x: asteroid.x, y: asteroid.y }) < asteroid.size) {
            bullet.life = -1;
            asteroid.size = -1;
            score += 10;
            splitAsteroid(asteroid);
            engine.particles.emitBurst(asteroid.x, asteroid.y, '#b3dcff', 14);
          }
        });
        if (ufo && distance({ x: bullet.x, y: bullet.y }, { x: ufo.x, y: ufo.y }) < 18) {
          score += 35;
          bullet.life = -1;
          ufo = null;
        }
      });

      asteroids = asteroids.filter((asteroid) => asteroid.size > 0);
      if (asteroids.length < 4) spawnWave(3);

      const shipHit = asteroids.some((asteroid) => distance({ x: ship.x, y: ship.y }, asteroid) < asteroid.size + 8);
      if (shipHit) {
        lives -= 1;
        ship.x = width / 2;
        ship.y = height / 2;
        ship.vx = 0;
        ship.vy = 0;
        if (lives <= 0) ended = true;
      }

      if (!ufo && Math.random() < 0.0025) {
        ufo = {
          x: Math.random() > 0.5 ? -30 : width + 30,
          y: rand(80, height - 160),
          vx: Math.random() > 0.5 ? 90 : -90,
          cooldown: 1,
        };
      }

      if (ufo) {
        ufo.x += ufo.vx * deltaTime;
        ufo.cooldown -= deltaTime;
        if (ufo.cooldown <= 0) {
          ufo.cooldown = rand(0.8, 1.6);
          const dx = ship.x - ufo.x;
          const dy = ship.y - ufo.y;
          const len = Math.hypot(dx, dy) || 1;
          bullets.push({ x: ufo.x, y: ufo.y, vx: (dx / len) * 220, vy: (dy / len) * 220, life: 2 });
        }
        if (ufo.x < -80 || ufo.x > width + 80) ufo = null;
      }
    },
    render: (ctx, w, h) => {
      ctx.fillStyle = '#05080f';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = '#8cc7ff';
      ctx.lineWidth = 1.6;
      asteroids.forEach((asteroid) => {
        ctx.beginPath();
        for (let i = 0; i < 8; i += 1) {
          const angle = (i / 8) * Math.PI * 2;
          const radius = asteroid.size * (0.78 + (i % 3) * 0.08);
          const x = asteroid.x + Math.cos(angle) * radius;
          const y = asteroid.y + Math.sin(angle) * radius;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
      });

      ctx.strokeStyle = '#c6f0ff';
      ctx.beginPath();
      const tip = angleToVec(ship.angle);
      const left = angleToVec(ship.angle + 2.55);
      const right = angleToVec(ship.angle - 2.55);
      ctx.moveTo(ship.x + tip.x * 16, ship.y + tip.y * 16);
      ctx.lineTo(ship.x + left.x * 12, ship.y + left.y * 12);
      ctx.lineTo(ship.x + right.x * 12, ship.y + right.y * 12);
      ctx.closePath();
      ctx.stroke();

      bullets.forEach((bullet) => {
        ctx.fillStyle = '#fff';
        ctx.fillRect(bullet.x - 2, bullet.y - 2, 4, 4);
      });

      if (ufo) {
        ctx.strokeStyle = '#ff8fae';
        ctx.strokeRect(ufo.x - 18, ufo.y - 8, 36, 16);
      }

      ctx.fillStyle = '#edf5ff';
      ctx.font = '600 16px "Space Grotesk", sans-serif';
      ctx.fillText(`Score: ${score}`, 16, 26);
      ctx.fillText(`Lives: ${lives}`, 16, 48);

      if (ended) {
        ctx.fillStyle = 'rgba(0,0,0,0.58)';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#fff';
        ctx.font = '700 30px "Space Grotesk", sans-serif';
        ctx.fillText('Asteroids overwhelmed', w * 0.31, h * 0.45);
      }
    },
    renderTextState: () => ({
      mode: ended ? 'game_over' : 'running',
      coordinates: 'origin top-left, +x right, +y down',
      game: 'asteroids',
      ship,
      asteroids: asteroids.map((asteroid) => ({ x: asteroid.x, y: asteroid.y, vx: asteroid.vx, vy: asteroid.vy, size: asteroid.size })),
      bullets,
      ufo,
      score,
      lives,
    }),
    startAI: () => {
      engine.ai.start('asteroids');
      engine.achievements.unlock('ai_observer');
    },
    stopAI: () => engine.ai.stop('asteroids'),
  });

  return game;
}

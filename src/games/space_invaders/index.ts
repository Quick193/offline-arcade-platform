import type { EngineContext, GameHandle } from '@/engine/Scene';
import { createCanvasGame } from '@/games/common/canvasGame';
import { clamp, rand, randInt } from '@/utils/math';

interface Invader {
  x: number;
  y: number;
  alive: boolean;
  frame: number;
}

interface Bullet {
  x: number;
  y: number;
  vy: number;
  enemy: boolean;
}

interface Shield {
  x: number;
  hp: number;
}

export function createGame(canvas: HTMLCanvasElement, engine: EngineContext): GameHandle {
  let width = 900;
  let height = 506;
  let playerX = 420;
  let bullets: Bullet[] = [];
  let invaders: Invader[] = [];
  let shields: Shield[] = [];
  let direction = 1;
  let speed = 34;
  let wave = 1;
  let lives = 3;
  let score = 0;
  let fireCooldown = 0;
  let enemyFireCooldown = 0;
  let ended = false;
  let sessionStart = 0;

  const unsubscribers: Array<() => void> = [];

  const spawnWave = () => {
    invaders = [];
    for (let row = 0; row < 5; row += 1) {
      for (let col = 0; col < 10; col += 1) {
        invaders.push({
          x: 100 + col * 62,
          y: 70 + row * 38,
          alive: true,
          frame: 0,
        });
      }
    }

    shields = [
      { x: width * 0.23, hp: 12 },
      { x: width * 0.5, hp: 12 },
      { x: width * 0.77, hp: 12 },
    ];

    bullets = [];
    direction = 1;
    speed = 32 + wave * 6;
  };

  const shoot = () => {
    if (fireCooldown > 0 || ended) return;
    fireCooldown = 0.24;
    bullets.push({ x: playerX, y: height - 56, vy: -420, enemy: false });
    engine.audio.playTone(580, 0.03, 'square', 'sfx');
  };

  const aiStep = () => {
    if (ended) return;

    const enemyBullets = bullets.filter((bullet) => bullet.enemy);
    const nearestDanger = enemyBullets
      .filter((bullet) => bullet.y > height * 0.45)
      .sort((a, b) => a.y - b.y)[0];

    if (nearestDanger) {
      if (nearestDanger.x < playerX) playerX += 16;
      else playerX -= 16;
    } else {
      const aliveInvaders = invaders.filter((invader) => invader.alive);
      if (aliveInvaders.length) {
        const closest = aliveInvaders.reduce((best, invader) =>
          Math.abs(invader.y - (height - 80)) < Math.abs(best.y - (height - 80)) ? invader : best,
        );
        const target = closest.x;
        if (Math.abs(target - playerX) > 12) {
          playerX += Math.sign(target - playerX) * 12;
        } else {
          shoot();
        }
      }
    }

    playerX = clamp(playerX, 30, width - 30);

    if (Math.random() > 0.72) shoot();
  };

  const game = createCanvasGame(canvas, engine, {
    id: 'space_invaders',
    onStart: () => {
      sessionStart = engine.profile.beginSession('space_invaders');
      wave = 1;
      lives = 3;
      score = 0;
      ended = false;
      playerX = width * 0.5;
      spawnWave();

      engine.input.setTarget(canvas);
      unsubscribers.push(
        engine.input.events.on('keydown', (event) => {
          if (event.key === 'ArrowLeft') playerX -= 24;
          if (event.key === 'ArrowRight') playerX += 24;
          if (event.key === ' ' || event.key.toLowerCase() === 'x') shoot();
          if (event.key.toLowerCase() === 'r') {
            wave = 1;
            lives = 3;
            score = 0;
            ended = false;
            spawnWave();
          }
        }),
      );
      unsubscribers.push(
        engine.input.events.on('tap', ({ x }) => {
          playerX = x;
          shoot();
        }),
      );
      unsubscribers.push(
        engine.input.events.on('swipe', (swipe) => {
          if (swipe.direction === 'left') playerX -= 26;
          if (swipe.direction === 'right') playerX += 26;
        }),
      );

      engine.ai.register(
        'space_invaders',
        {
          tickAI: () => aiStep(),
          onPlayerOverride: () => engine.audio.playTone(140, 0.03, 'sine', 'sfx'),
        },
        { hz: 30 },
      );
      engine.ai.setCurrentGame('space_invaders');
    },
    onStop: () => {
      unsubscribers.splice(0).forEach((u) => u());
      engine.ai.stop('space_invaders');
      engine.ai.unregister('space_invaders');
      engine.profile.endSession(sessionStart);
      engine.profile.setBestScore('space_invaders', score);
    },
    onResize: (w, h) => {
      width = w;
      height = h;
      playerX = clamp(playerX, 30, width - 30);
    },
    update: (deltaTime) => {
      if (ended) return;
      fireCooldown = Math.max(0, fireCooldown - deltaTime);
      enemyFireCooldown = Math.max(0, enemyFireCooldown - deltaTime);

      playerX = clamp(playerX, 30, width - 30);

      const alive = invaders.filter((invader) => invader.alive);
      if (!alive.length) {
        wave += 1;
        spawnWave();
        return;
      }

      let shouldDrop = false;
      alive.forEach((invader) => {
        invader.x += direction * speed * deltaTime;
        invader.frame += deltaTime * 6;
        if (invader.x < 36 || invader.x > width - 36) {
          shouldDrop = true;
        }
      });

      if (shouldDrop) {
        direction *= -1;
        invaders.forEach((invader) => {
          invader.y += 20;
        });
      }

      if (enemyFireCooldown <= 0 && alive.length) {
        enemyFireCooldown = Math.max(0.18, 1 - wave * 0.05);
        const shooter = alive[randInt(0, alive.length - 1)];
        bullets.push({ x: shooter.x, y: shooter.y + 14, vy: rand(160, 240), enemy: true });
      }

      bullets.forEach((bullet) => {
        bullet.y += bullet.vy * deltaTime;
      });
      bullets = bullets.filter((bullet) => bullet.y > -20 && bullet.y < height + 20);

      bullets.forEach((bullet) => {
        if (!bullet.enemy) {
          invaders.forEach((invader) => {
            if (!invader.alive) return;
            if (Math.abs(bullet.x - invader.x) < 20 && Math.abs(bullet.y - invader.y) < 14) {
              invader.alive = false;
              bullet.y = -40;
              score += 12;
              engine.particles.emitBurst(invader.x, invader.y, '#8fffb9', 12);
            }
          });
        }

        if (bullet.enemy) {
          if (Math.abs(bullet.x - playerX) < 18 && bullet.y > height - 72 && bullet.y < height - 40) {
            lives -= 1;
            bullet.y = height + 40;
            engine.audio.playTone(130, 0.2, 'sawtooth', 'sfx');
            if (lives <= 0) {
              ended = true;
            }
          }
        }

        shields.forEach((shield) => {
          if (shield.hp <= 0) return;
          if (Math.abs(bullet.x - shield.x) < 42 && bullet.y > height - 130 && bullet.y < height - 92) {
            shield.hp -= 1;
            bullet.y = bullet.enemy ? height + 40 : -40;
          }
        });
      });

      if (invaders.some((invader) => invader.alive && invader.y > height - 110)) {
        ended = true;
      }
    },
    render: (ctx, w, h) => {
      ctx.fillStyle = '#08111f';
      ctx.fillRect(0, 0, w, h);

      for (let i = 0; i < 90; i += 1) {
        ctx.fillStyle = `rgba(255,255,255,${0.05 + (i % 6) * 0.02})`;
        ctx.fillRect((i * 57) % w, (i * 103) % h, 2, 2);
      }

      invaders.forEach((invader) => {
        if (!invader.alive) return;
        const frame = Math.floor(invader.frame) % 2;
        ctx.fillStyle = '#88ff9f';
        ctx.fillRect(invader.x - 16, invader.y - 10, 32, 6);
        ctx.fillRect(invader.x - 12, invader.y - 4, 24, 8);
        ctx.fillRect(invader.x - 20, invader.y + 4, 8, 6);
        ctx.fillRect(invader.x + 12, invader.y + 4, 8, 6);
        if (frame === 1) {
          ctx.fillRect(invader.x - 18, invader.y + 12, 6, 6);
          ctx.fillRect(invader.x + 12, invader.y + 12, 6, 6);
        }
      });

      shields.forEach((shield) => {
        if (shield.hp <= 0) return;
        const alpha = shield.hp / 12;
        ctx.fillStyle = `rgba(120,180,255,${alpha})`;
        ctx.fillRect(shield.x - 42, h - 130, 84, 38);
      });

      ctx.fillStyle = '#f4f9ff';
      ctx.fillRect(playerX - 18, h - 54, 36, 10);
      ctx.fillRect(playerX - 8, h - 68, 16, 14);

      bullets.forEach((bullet) => {
        ctx.fillStyle = bullet.enemy ? '#ff798a' : '#9ecfff';
        ctx.fillRect(bullet.x - 2, bullet.y - 6, 4, 12);
      });

      ctx.fillStyle = '#edf5ff';
      ctx.font = '600 16px "Space Grotesk", sans-serif';
      ctx.fillText(`Score ${score}`, 16, 26);
      ctx.fillText(`Lives ${lives}`, 16, 46);
      ctx.fillText(`Wave ${wave}`, 16, 66);

      if (ended) {
        ctx.fillStyle = 'rgba(0,0,0,0.62)';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#fff';
        ctx.font = '700 30px "Space Grotesk", sans-serif';
        ctx.fillText('Invasion complete', w * 0.34, h * 0.45);
      }
    },
    renderTextState: () => ({
      mode: ended ? 'game_over' : 'running',
      coordinates: 'origin top-left, +x right, +y down',
      game: 'space_invaders',
      playerX,
      bullets,
      invaders: invaders.filter((invader) => invader.alive).map((invader) => ({ x: invader.x, y: invader.y })),
      shields,
      wave,
      score,
      lives,
    }),
    startAI: () => {
      engine.ai.start('space_invaders');
      engine.achievements.unlock('ai_observer');
    },
    stopAI: () => engine.ai.stop('space_invaders'),
  });

  return game;
}

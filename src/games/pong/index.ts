import type { EngineContext, GameHandle } from '@/engine/Scene';
import { createCanvasGame } from '@/games/common/canvasGame';
import { clamp, rand } from '@/utils/math';

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  trail: Array<{ x: number; y: number }>;
}

type Mode = 'ai' | 'pvp' | 'tournament';

export function createGame(canvas: HTMLCanvasElement, engine: EngineContext): GameHandle {
  let leftY = 180;
  let rightY = 180;
  let leftHeight = 100;
  let rightHeight = 100;
  let leftScore = 0;
  let rightScore = 0;
  let balls: Ball[] = [];
  let mode: Mode = 'ai';
  let tournamentRound = 1;
  let aiDelay = 0.08;
  let aiTimer = 0;
  let aiTargetY = 180;
  let running = true;
  let sessionStart = 0;

  const unsubscribers: Array<() => void> = [];
  let width = 900;
  let height = 506;

  const makeBall = (dir: number): Ball => ({
    x: width / 2,
    y: height / 2,
    vx: dir * rand(280, 340),
    vy: rand(-120, 120),
    trail: [],
  });

  const resetRound = () => {
    balls = [makeBall(Math.random() > 0.5 ? 1 : -1)];
    leftY = height * 0.5 - leftHeight * 0.5;
    rightY = height * 0.5 - rightHeight * 0.5;
  };

  const collisionWithPaddle = (ball: Ball, isLeft: boolean): boolean => {
    const x = isLeft ? 24 : width - 36;
    const y = isLeft ? leftY : rightY;
    const h = isLeft ? leftHeight : rightHeight;

    if (ball.y < y || ball.y > y + h) return false;
    if (isLeft && ball.x - 8 > x + 12) return false;
    if (!isLeft && ball.x + 8 < x) return false;

    const offset = (ball.y - (y + h / 2)) / (h / 2);
    const bounce = clamp(offset, -1, 1) * 0.85;
    const speed = Math.hypot(ball.vx, ball.vy) * 1.03;

    ball.vx = (isLeft ? 1 : -1) * speed * Math.cos(bounce);
    ball.vy = speed * Math.sin(bounce);

    if (engine.input.isPressed('shift')) {
      ball.vx *= 1.2;
      ball.vy += isLeft ? -40 : 40;
    }

    return true;
  };

  const updateAI = (deltaTime: number) => {
    if (mode === 'pvp') return;
    aiTimer += deltaTime;
    if (aiTimer < aiDelay) return;
    aiTimer = 0;

    const primary = balls[0];
    if (!primary) return;

    const timeToPaddle = Math.abs((width - 36 - primary.x) / (primary.vx || 1));
    const predictedY = primary.y + primary.vy * timeToPaddle;
    const accuracy = mode === 'tournament' ? 0.95 : 0.85;
    const noise = (1 - accuracy) * rand(-70, 70);
    aiTargetY = clamp(predictedY + noise - rightHeight / 2, 0, height - rightHeight);

    const speed = mode === 'tournament' ? 420 : 340;
    const step = speed * deltaTime;
    if (rightY < aiTargetY) rightY = Math.min(aiTargetY, rightY + step);
    if (rightY > aiTargetY) rightY = Math.max(aiTargetY, rightY - step);
  };

  const updateBall = (ball: Ball, deltaTime: number) => {
    ball.x += ball.vx * deltaTime;
    ball.y += ball.vy * deltaTime;

    ball.trail.unshift({ x: ball.x, y: ball.y });
    ball.trail = ball.trail.slice(0, 14);

    if (ball.y <= 8 || ball.y >= height - 8) {
      ball.vy *= -1;
      ball.y = clamp(ball.y, 8, height - 8);
    }

    collisionWithPaddle(ball, true);
    collisionWithPaddle(ball, false);
  };

  const scorePoint = (rightSide: boolean) => {
    if (rightSide) rightScore += 1;
    else leftScore += 1;

    if ((leftScore + rightScore) % 5 === 0 && balls.length < 3) {
      balls.push(makeBall(Math.random() > 0.5 ? 1 : -1));
    }

    leftHeight = Math.max(56, leftHeight - 1.5);
    rightHeight = Math.max(56, rightHeight - 1.5);

    engine.audio.playTone(rightSide ? 540 : 420, 0.08, 'square', 'sfx');

    if (mode === 'tournament' && (leftScore >= 7 || rightScore >= 7)) {
      tournamentRound += 1;
      aiDelay = Math.max(0.03, aiDelay * 0.92);
      leftScore = 0;
      rightScore = 0;
      leftHeight = 100;
      rightHeight = 100;
    }

    resetRound();
  };

  const onPointerMove = (x: number, y: number) => {
    if (x < width / 2) {
      leftY = clamp(y - leftHeight / 2, 0, height - leftHeight);
    } else if (mode === 'pvp') {
      rightY = clamp(y - rightHeight / 2, 0, height - rightHeight);
    }
  };

  const onKey = (event: KeyboardEvent) => {
    const step = 18;
    if (event.key.toLowerCase() === 'm') {
      mode = mode === 'ai' ? 'pvp' : mode === 'pvp' ? 'tournament' : 'ai';
      resetRound();
    }
    if (event.key.toLowerCase() === 'r') {
      leftScore = 0;
      rightScore = 0;
      tournamentRound = 1;
      leftHeight = 100;
      rightHeight = 100;
      resetRound();
    }

    if (event.key.toLowerCase() === 'w') leftY = clamp(leftY - step, 0, height - leftHeight);
    if (event.key.toLowerCase() === 's') leftY = clamp(leftY + step, 0, height - leftHeight);

    if (mode === 'pvp') {
      if (event.key === 'ArrowUp') rightY = clamp(rightY - step, 0, height - rightHeight);
      if (event.key === 'ArrowDown') rightY = clamp(rightY + step, 0, height - rightHeight);
    }
  };

  const aiPlay = () => {
    if (!running) return;
    const main = balls[0];
    if (!main) return;
    const target = main.y - leftHeight / 2;
    leftY = clamp(leftY + Math.sign(target - leftY) * 15, 0, height - leftHeight);
  };

  const game = createCanvasGame(canvas, engine, {
    id: 'pong',
    onStart: () => {
      sessionStart = engine.profile.beginSession('pong');
      leftScore = 0;
      rightScore = 0;
      leftHeight = 100;
      rightHeight = 100;
      mode = 'ai';
      tournamentRound = 1;
      aiDelay = 0.08;
      running = true;
      resetRound();

      engine.input.setTarget(canvas);
      unsubscribers.push(engine.input.events.on('keydown', onKey));
      unsubscribers.push(
        engine.input.events.on('pointermove', ({ x, y }) => {
          onPointerMove(x, y);
        }),
      );
      unsubscribers.push(
        engine.input.events.on('swipe', (swipe) => {
          if (swipe.direction === 'up') leftY = clamp(leftY - 26, 0, height - leftHeight);
          if (swipe.direction === 'down') leftY = clamp(leftY + 26, 0, height - leftHeight);
        }),
      );

      engine.ai.register(
        'pong',
        {
          tickAI: () => aiPlay(),
          onPlayerOverride: () => {
            engine.audio.playTone(140, 0.04, 'triangle', 'sfx');
          },
        },
        { hz: 30 },
      );
      engine.ai.setCurrentGame('pong');
    },
    onStop: () => {
      unsubscribers.splice(0).forEach((dispose) => dispose());
      engine.ai.stop('pong');
      engine.ai.unregister('pong');
      engine.profile.endSession(sessionStart);
      engine.profile.setBestScore('pong', leftScore);
    },
    onResize: (w, h) => {
      width = w;
      height = h;
    },
    update: (deltaTime) => {
      if (!running) return;

      updateAI(deltaTime);

      balls.forEach((ball) => updateBall(ball, deltaTime));
      balls = balls.filter((ball) => {
        if (ball.x < -16) {
          scorePoint(true);
          return false;
        }
        if (ball.x > width + 16) {
          scorePoint(false);
          return false;
        }
        return true;
      });

      if (balls.length === 0) {
        balls = [makeBall(Math.random() > 0.5 ? 1 : -1)];
      }
    },
    render: (ctx, w, h) => {
      ctx.fillStyle = '#0a1020';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.setLineDash([8, 12]);
      ctx.beginPath();
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(w / 2, h);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#8ae8ff';
      ctx.fillRect(24, leftY, 12, leftHeight);
      ctx.fillStyle = '#ff8ad6';
      ctx.fillRect(w - 36, rightY, 12, rightHeight);

      balls.forEach((ball) => {
        ball.trail.forEach((point, index) => {
          const alpha = (ball.trail.length - index) / ball.trail.length;
          ctx.fillStyle = `rgba(120,220,255,${alpha * 0.4})`;
          ctx.beginPath();
          ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
          ctx.fill();
        });

        ctx.fillStyle = '#f2f8ff';
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, 8, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.fillStyle = '#eef3ff';
      ctx.font = '700 34px "Space Grotesk", sans-serif';
      ctx.fillText(String(leftScore), w * 0.44, 56);
      ctx.fillText(String(rightScore), w * 0.54, 56);

      ctx.font = '600 14px "Space Grotesk", sans-serif';
      ctx.fillText(`Mode: ${mode.toUpperCase()} (M to switch)`, 18, h - 24);
      if (mode === 'tournament') {
        ctx.fillText(`Round: ${tournamentRound}`, w - 130, h - 24);
      }
    },
    renderTextState: () => ({
      mode: 'running',
      coordinates: 'origin top-left, +x right, +y down',
      game: 'pong',
      paddles: {
        left: { y: leftY, height: leftHeight },
        right: { y: rightY, height: rightHeight },
      },
      balls: balls.map((ball) => ({ x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy })),
      score: { left: leftScore, right: rightScore },
      modeType: mode,
    }),
    startAI: () => {
      engine.ai.start('pong');
      engine.achievements.unlock('ai_observer');
    },
    stopAI: () => {
      engine.ai.stop('pong');
    },
  });

  return game;
}

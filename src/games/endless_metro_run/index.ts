import type { EngineContext, GameHandle } from '@/engine/Scene';
import { createCanvasGame } from '@/games/common/canvasGame';
import { clamp, chance, randInt } from '@/utils/math';

interface SegmentObj {
  lane: number;
  z: number;
  type: 'train' | 'post' | 'pit' | 'coin' | 'magnet' | 'shield';
}

export function createGame(canvas: HTMLCanvasElement, engine: EngineContext): GameHandle {
  let lane = 1;
  let speed = 22;
  let distance = 0;
  let score = 0;
  let coins = 0;
  let shield = 0;
  let magnet = 0;
  let objects: SegmentObj[] = [];
  let ended = false;
  let sessionStart = 0;

  const unsubscribers: Array<() => void> = [];

  const reset = () => {
    lane = 1;
    speed = 22;
    distance = 0;
    score = 0;
    coins = 0;
    shield = 0;
    magnet = 0;
    ended = false;
    objects = [];

    for (let i = 0; i < 36; i += 1) {
      objects.push(generateObject(120 + i * 28));
    }
  };

  const generateObject = (z: number): SegmentObj => {
    const roll = randInt(0, 100);
    const lane = randInt(0, 2);
    if (roll < 38) return { lane, z, type: 'coin' };
    if (roll < 52) return { lane, z, type: 'post' };
    if (roll < 62) return { lane, z, type: 'train' };
    if (roll < 70) return { lane, z, type: 'pit' };
    if (roll < 76) return { lane, z, type: 'magnet' };
    if (roll < 82) return { lane, z, type: 'shield' };
    return { lane, z, type: 'coin' };
  };

  const changeLane = (next: number) => {
    lane = clamp(next, 0, 2);
  };

  const onHitObstacle = () => {
    if (shield > 0) {
      shield = Math.max(0, shield - 2);
      engine.audio.playTone(200, 0.05, 'triangle', 'sfx');
      return;
    }
    ended = true;
    engine.audio.playTone(110, 0.3, 'sawtooth', 'sfx');
  };

  const aiStep = () => {
    if (ended) return;

    const lookAhead = objects.filter((obj) => obj.z < 26 && obj.z > 0);
    const laneRisk = [0, 1, 2].map((candidateLane) => {
      let risk = 0;
      let reward = 0;
      lookAhead.forEach((obj) => {
        if (obj.lane !== candidateLane) return;
        if (obj.type === 'coin') reward += obj.z < 12 ? 3 : 1;
        if (obj.type === 'magnet' || obj.type === 'shield') reward += 6;
        if (obj.type === 'train' || obj.type === 'post' || obj.type === 'pit') risk += obj.z < 10 ? 12 : 4;
      });
      return { lane: candidateLane, score: reward - risk };
    });

    laneRisk.sort((a, b) => b.score - a.score);
    changeLane(laneRisk[0].lane);
  };

  const game = createCanvasGame(canvas, engine, {
    id: 'endless_metro_run',
    onStart: () => {
      sessionStart = engine.profile.beginSession('endless_metro_run');
      reset();

      engine.input.setTarget(canvas);
      unsubscribers.push(
        engine.input.events.on('keydown', (event) => {
          if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') changeLane(lane - 1);
          if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') changeLane(lane + 1);
          if (event.key.toLowerCase() === 'r') reset();
        }),
      );
      unsubscribers.push(
        engine.input.events.on('swipe', (swipe) => {
          if (swipe.direction === 'left') changeLane(lane - 1);
          if (swipe.direction === 'right') changeLane(lane + 1);
        }),
      );

      engine.ai.register(
        'endless_metro_run',
        {
          tickAI: () => aiStep(),
          onPlayerOverride: () => engine.audio.playTone(150, 0.03, 'sine', 'sfx'),
        },
        { hz: 25 },
      );
      engine.ai.setCurrentGame('endless_metro_run');
    },
    onStop: () => {
      unsubscribers.splice(0).forEach((u) => u());
      engine.ai.stop('endless_metro_run');
      engine.ai.unregister('endless_metro_run');
      engine.profile.endSession(sessionStart);
      engine.profile.setBestScore('endless_metro_run', score);
    },
    update: (deltaTime) => {
      if (ended) return;
      distance += speed * deltaTime;
      score = Math.floor(distance + coins * 5);
      speed = Math.min(50, 22 + distance * 0.02);
      shield = Math.max(0, shield - deltaTime * 0.2);
      magnet = Math.max(0, magnet - deltaTime * 0.2);

      objects.forEach((obj) => {
        obj.z -= speed * deltaTime;
      });

      objects.forEach((obj) => {
        if (obj.z < 1.5 && obj.z > -0.3) {
          const laneMatch = obj.lane === lane;
          const nearLane = Math.abs(obj.lane - lane) === 1;

          if (obj.type === 'coin' && (laneMatch || (magnet > 0 && nearLane))) {
            coins += 1;
            obj.z = -10;
            engine.audio.playTone(530, 0.02, 'triangle', 'sfx');
          }
          if (obj.type === 'magnet' && laneMatch) {
            magnet = 8;
            obj.z = -10;
          }
          if (obj.type === 'shield' && laneMatch) {
            shield = 8;
            obj.z = -10;
          }

          if ((obj.type === 'train' || obj.type === 'post' || obj.type === 'pit') && laneMatch) {
            onHitObstacle();
            obj.z = -10;
          }
        }
      });

      const farthest = Math.max(...objects.map((obj) => obj.z));
      objects = objects
        .filter((obj) => obj.z > -6)
        .concat(
          Array.from({ length: Math.max(0, 32 - objects.length) }, (_, index) =>
            generateObject(farthest + 28 + index * 28 + randInt(0, 8)),
          ),
        );

      if (distance > 1200 && !engine.achievements.isUnlocked('marathoner')) {
        engine.achievements.unlock('marathoner');
      }
    },
    render: (ctx, width, height) => {
      ctx.fillStyle = '#0d1628';
      ctx.fillRect(0, 0, width, height);

      for (let i = 0; i < 3; i += 1) {
        ctx.fillStyle = `rgba(120,160,220,${0.18 - i * 0.04})`;
        ctx.fillRect(0, height * (0.4 + i * 0.1), width, height * 0.12);
      }

      const laneWidth = width / 5;
      const laneCenters = [width * 0.3, width * 0.5, width * 0.7];

      laneCenters.forEach((center, index) => {
        ctx.strokeStyle = index === lane ? '#8fd3ff' : 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(center - laneWidth * 0.5, height);
        ctx.lineTo(center - laneWidth * 0.2, height * 0.2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(center + laneWidth * 0.5, height);
        ctx.lineTo(center + laneWidth * 0.2, height * 0.2);
        ctx.stroke();
      });

      const project = (obj: SegmentObj) => {
        const depth = Math.max(1, obj.z);
        const scale = clamp(1 / depth * 8, 0.2, 3);
        const x = laneCenters[obj.lane];
        const y = height - depth * 9;
        return { x, y, scale };
      };

      objects
        .slice()
        .sort((a, b) => b.z - a.z)
        .forEach((obj) => {
          const { x, y, scale } = project(obj);
          if (obj.type === 'coin') {
            ctx.fillStyle = '#ffd45f';
            ctx.beginPath();
            ctx.arc(x, y, 6 * scale, 0, Math.PI * 2);
            ctx.fill();
          }
          if (obj.type === 'magnet' || obj.type === 'shield') {
            ctx.fillStyle = obj.type === 'magnet' ? '#8be7ff' : '#7dff9d';
            ctx.fillRect(x - 8 * scale, y - 8 * scale, 16 * scale, 16 * scale);
          }
          if (obj.type === 'post') {
            ctx.fillStyle = '#ff9a5b';
            ctx.fillRect(x - 8 * scale, y - 22 * scale, 16 * scale, 30 * scale);
          }
          if (obj.type === 'train') {
            ctx.fillStyle = '#ff6f7b';
            ctx.fillRect(x - 24 * scale, y - 24 * scale, 48 * scale, 40 * scale);
          }
          if (obj.type === 'pit') {
            ctx.fillStyle = '#0a0a0a';
            ctx.fillRect(x - 22 * scale, y - 6 * scale, 44 * scale, 14 * scale);
          }
        });

      const playerX = laneCenters[lane];
      ctx.fillStyle = shield > 0 ? '#a6ffdd' : '#f3f9ff';
      ctx.fillRect(playerX - 14, height - 80, 28, 42);

      ctx.fillStyle = '#edf6ff';
      ctx.font = '600 16px "Space Grotesk", sans-serif';
      ctx.fillText(`Score: ${score}`, 14, 24);
      ctx.fillText(`Coins: ${coins}`, 14, 46);
      ctx.fillText(`Speed: ${speed.toFixed(1)}`, 14, 68);
      ctx.fillText(`Magnet: ${magnet.toFixed(1)}`, 14, 90);
      ctx.fillText(`Shield: ${shield.toFixed(1)}`, 14, 112);

      if (ended) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#fff';
        ctx.font = '700 30px "Space Grotesk", sans-serif';
        ctx.fillText('Run ended', width * 0.42, height * 0.45);
      }
    },
    renderTextState: () => ({
      mode: ended ? 'game_over' : 'running',
      coordinates: 'origin top-left, +x right, +y down',
      game: 'endless_metro_run',
      lane,
      speed,
      distance,
      score,
      coins,
      shield,
      magnet,
      objects: objects.filter((obj) => obj.z > 0 && obj.z < 40),
    }),
    startAI: () => {
      engine.ai.start('endless_metro_run');
      engine.achievements.unlock('ai_observer');
    },
    stopAI: () => engine.ai.stop('endless_metro_run'),
  });

  return game;
}

import { useEffect, useRef } from 'react';
import type { GameMeta } from '@/data/gameMeta';

interface MainMenuProps {
  games: GameMeta[];
  onSelectGame: (gameId: string) => void;
}

function drawPreview(canvas: HTMLCanvasElement, text: string, time: number): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;

  const hue = (time * 55) % 360;
  ctx.fillStyle = `hsl(${hue}, 45%, 12%)`;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = `hsl(${(hue + 45) % 360}, 90%, 64%)`;
  ctx.lineWidth = 3;
  ctx.strokeRect(6, 6, width - 12, height - 12);

  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = 'bold 12px "Fira Sans", sans-serif';
  ctx.fillText(text.slice(0, 15), 12, height / 2 + 4);

  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  const radius = 10 + Math.sin(time * 2.5) * 4;
  ctx.beginPath();
  ctx.arc(width * 0.82, height * 0.28, radius, 0, Math.PI * 2);
  ctx.fill();
}

export function MainMenu({ games, onSelectGame }: MainMenuProps): JSX.Element {
  const refs = useRef<Record<string, HTMLCanvasElement | null>>({});

  useEffect(() => {
    let raf = 0;
    const start = performance.now();

    const frame = () => {
      const elapsed = (performance.now() - start) / 1000;
      games.forEach((game) => {
        const canvas = refs.current[game.id];
        if (!canvas) return;
        drawPreview(canvas, game.title, elapsed + Math.random() * 0.2);
      });
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [games]);

  return (
    <div className="main-menu">
      <div className="game-grid">
        {games.map((game) => (
          <div className="game-card" key={game.id} onClick={() => onSelectGame(game.id)}>
            <canvas
              className="preview"
              width={260}
              height={120}
              ref={(element) => {
                refs.current[game.id] = element;
              }}
            />
            <div className="title">{game.title}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

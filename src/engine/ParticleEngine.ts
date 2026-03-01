import { rand } from '@/utils/math';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

export class ParticleEngine {
  private particles: Particle[] = [];

  emitBurst(x: number, y: number, color: string, count = 12): void {
    for (let i = 0; i < count; i += 1) {
      this.particles.push({
        x,
        y,
        vx: rand(-120, 120),
        vy: rand(-120, 120),
        life: rand(0.25, 0.8),
        maxLife: rand(0.25, 0.8),
        size: rand(1.5, 4),
        color,
      });
    }
  }

  update(deltaTime: number): void {
    this.particles = this.particles
      .map((particle) => ({
        ...particle,
        x: particle.x + particle.vx * deltaTime,
        y: particle.y + particle.vy * deltaTime,
        vy: particle.vy + 180 * deltaTime,
        life: particle.life - deltaTime,
      }))
      .filter((particle) => particle.life > 0);
  }

  render(ctx: CanvasRenderingContext2D): void {
    this.particles.forEach((particle) => {
      const alpha = particle.life / particle.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  clear(): void {
    this.particles = [];
  }

  get count(): number {
    return this.particles.length;
  }
}

export interface Vec2 {
  x: number;
  y: number;
}

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const lerp = (from: number, to: number, alpha: number): number => from + (to - from) * alpha;

export const rand = (min: number, max: number): number => Math.random() * (max - min) + min;

export const randInt = (min: number, max: number): number => Math.floor(rand(min, max + 1));

export const chance = (probability: number): boolean => Math.random() < probability;

export const distance = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);

export const normalize = (v: Vec2): Vec2 => {
  const len = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / len, y: v.y / len };
};

export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;

export const angleToVec = (angle: number): Vec2 => ({ x: Math.cos(angle), y: Math.sin(angle) });

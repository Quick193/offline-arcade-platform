export const GAME_LIST = [
  'tetris', 'snake', 'pong', 'flappy', 'chess',
  'neon_blob_dash', 'game_2048', 'breakout',
  'space_invaders', 'endless_metro_run', 'minesweeper',
  'memory_match', 'connect4', 'sudoku', 'asteroids',
] as const;

export type GameId = (typeof GAME_LIST)[number];

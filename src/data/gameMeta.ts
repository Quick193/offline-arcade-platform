import type { GameId } from './gameList';

export interface GameMeta {
  id: GameId;
  title: string;
  description: string;
  aiCapable: boolean;
}

export const GAME_META: GameMeta[] = [
  { id: 'tetris', title: 'Tetris Pro', description: 'SRS stack battle with hold and ghosts.', aiCapable: true },
  { id: 'snake', title: 'Snake 2.0', description: 'Adaptive arena snake with powerups.', aiCapable: true },
  { id: 'pong', title: 'Pong 2.0', description: 'Advanced paddle physics and spin shots.', aiCapable: true },
  { id: 'flappy', title: 'Flappy 2.0', description: 'Parallax flight with wind zones.', aiCapable: true },
  { id: 'chess', title: 'Chess Pro', description: 'Full rules, PGN, arrows, minimax AI.', aiCapable: true },
  { id: 'neon_blob_dash', title: 'Neon Blob Dash', description: 'BPM synced runner with obstacles.', aiCapable: true },
  { id: 'game_2048', title: '2048', description: 'Expectimax-enhanced merge puzzle.', aiCapable: true },
  { id: 'breakout', title: 'Breakout', description: 'Durable bricks and powerup chaos.', aiCapable: true },
  { id: 'space_invaders', title: 'Space Invaders', description: 'Wave shooter with shields.', aiCapable: true },
  { id: 'endless_metro_run', title: 'Endless Metro Run', description: 'Lane switching endless sprint.', aiCapable: true },
  { id: 'minesweeper', title: 'Minesweeper', description: 'Safe-first reveal puzzle.', aiCapable: true },
  { id: 'memory_match', title: 'Memory Match', description: 'Reveal cards and complete pairs.', aiCapable: true },
  { id: 'connect4', title: 'Connect 4', description: 'Classic gravity board duel.', aiCapable: true },
  { id: 'sudoku', title: 'Sudoku', description: 'Constraint puzzle with hints.', aiCapable: true },
  { id: 'asteroids', title: 'Asteroids', description: 'Line-art thrust survival.', aiCapable: true },
];

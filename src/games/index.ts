import type { GameFactory } from './types';
import { createGame as createTetris } from './tetris';
import { createGame as createSnake } from './snake';
import { createGame as createPong } from './pong';
import { createGame as createFlappy } from './flappy';
import { createGame as createChess } from './chess';
import { createGame as createNeonBlobDash } from './neon_blob_dash';
import { createGame as create2048 } from './game_2048';
import { createGame as createBreakout } from './breakout';
import { createGame as createSpaceInvaders } from './space_invaders';
import { createGame as createEndlessMetroRun } from './endless_metro_run';
import { createGame as createMinesweeper } from './minesweeper';
import { createGame as createMemoryMatch } from './memory_match';
import { createGame as createConnect4 } from './connect4';
import { createGame as createSudoku } from './sudoku';
import { createGame as createAsteroids } from './asteroids';

export const GAME_REGISTRY: Record<string, GameFactory> = {
  tetris: createTetris,
  snake: createSnake,
  pong: createPong,
  flappy: createFlappy,
  chess: createChess,
  neon_blob_dash: createNeonBlobDash,
  game_2048: create2048,
  breakout: createBreakout,
  space_invaders: createSpaceInvaders,
  endless_metro_run: createEndlessMetroRun,
  minesweeper: createMinesweeper,
  memory_match: createMemoryMatch,
  connect4: createConnect4,
  sudoku: createSudoku,
  asteroids: createAsteroids,
};

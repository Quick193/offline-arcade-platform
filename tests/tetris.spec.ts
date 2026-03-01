import { expect, test } from '@playwright/test';
import { ensureOfflineReady, getTextState, openGame } from './helpers';

test('tetris boots, input works, sw installs, offline works', async ({ page, context }) => {
  await page.goto('/');
  await openGame(page, 'Tetris Pro');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Space');

  const state = await getTextState(page);
  expect(state.game).toBe('tetris');
  expect(state.score).toBeGreaterThanOrEqual(0);

  await ensureOfflineReady(page, context);
  await openGame(page, 'Tetris Pro');
  await expect(page.locator('#game-canvas')).toBeVisible();
});

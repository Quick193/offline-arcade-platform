import { expect, test } from '@playwright/test';
import { ensureOfflineReady, getTextState, openGame } from './helpers';

test('snake boots, input works, sw installs, offline works', async ({ page, context }) => {
  await page.goto('/');
  await openGame(page, 'Snake 2.0');
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(220);
  await page.keyboard.press('ArrowRight');

  const state = await getTextState(page);
  expect(state.game).toBe('snake');
  expect(state.snake.length).toBeGreaterThan(2);

  await ensureOfflineReady(page, context);
  await openGame(page, 'Snake 2.0');
  await expect(page.locator('#game-canvas')).toBeVisible();
});

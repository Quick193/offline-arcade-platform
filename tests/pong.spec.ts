import { expect, test } from '@playwright/test';
import { ensureOfflineReady, getTextState, openGame } from './helpers';

test('pong boots, input works, sw installs, offline works', async ({ page, context }) => {
  await page.goto('/');
  await openGame(page, 'Pong 2.0');
  await page.keyboard.press('w');
  await page.keyboard.press('s');

  const state = await getTextState(page);
  expect(state.game).toBe('pong');
  expect(state.balls.length).toBeGreaterThan(0);

  await ensureOfflineReady(page, context);
  await openGame(page, 'Pong 2.0');
  await expect(page.locator('#game-canvas')).toBeVisible();
});

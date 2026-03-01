import { expect, test } from '@playwright/test';
import { ensureOfflineReady, getTextState, openGame } from './helpers';

test('flappy boots, input works, sw installs, offline works', async ({ page, context }) => {
  await page.goto('/');
  await openGame(page, 'Flappy 2.0');
  await page.keyboard.press('Space');
  await page.waitForTimeout(120);
  await page.keyboard.press('Space');

  const state = await getTextState(page);
  expect(state.game).toBe('flappy');
  expect(state.bird.y).toBeGreaterThan(0);

  await ensureOfflineReady(page, context);
  await openGame(page, 'Flappy 2.0');
  await expect(page.locator('#game-canvas')).toBeVisible();
});

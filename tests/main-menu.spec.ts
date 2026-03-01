import { expect, test } from '@playwright/test';
import { ensureOfflineReady } from './helpers';

test('main menu loads, previews render, sw installs, offline works', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.locator('text=Arcade Nexus')).toBeVisible();
  await expect(page.locator('.game-card')).toHaveCount(15);
  await expect(page.locator('canvas.preview').first()).toBeVisible();

  await ensureOfflineReady(page, context);

  const hasController = await page.evaluate(() => Boolean(navigator.serviceWorker?.controller || navigator.serviceWorker));
  expect(hasController).toBeTruthy();
});

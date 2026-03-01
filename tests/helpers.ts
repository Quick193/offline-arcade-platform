import { expect, type BrowserContext, type Page } from '@playwright/test';

export async function ensureServiceWorker(page: Page): Promise<void> {
  await page.waitForFunction(async () => {
    if (!('serviceWorker' in navigator)) return false;
    await navigator.serviceWorker.ready;
    return true;
  });

  await page.reload();
  await page.waitForTimeout(250);
}

export async function ensureOfflineReady(page: Page, context: BrowserContext): Promise<void> {
  await ensureServiceWorker(page);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('text=Arcade Nexus')).toBeVisible();
  await context.setOffline(false);
  await page.reload();
}

export async function openGame(page: Page, title: string): Promise<void> {
  const gameCard = page.locator('.game-card').filter({ hasText: title }).first();
  await expect(gameCard).toBeVisible();
  await gameCard.click();
  await expect(page.locator('#game-canvas')).toBeVisible();
}

export async function getTextState(page: Page): Promise<any> {
  const raw = await page.evaluate(() => window.render_game_to_text?.() ?? '{}');
  return JSON.parse(raw);
}

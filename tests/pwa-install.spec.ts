import { expect, test } from '@playwright/test';
import { ensureOfflineReady } from './helpers';

test('manifest, sw, offline and install readiness', async ({ page, context }) => {
  await page.goto('/');

  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(manifestHref).toBeTruthy();

  const manifest = await page.request.get('/manifest.webmanifest');
  expect(manifest.ok()).toBeTruthy();
  const json = await manifest.json();
  expect(json.display).toBe('standalone');
  expect(json.icons.length).toBeGreaterThanOrEqual(2);

  await ensureOfflineReady(page, context);

  const swReady = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return false;
    await navigator.serviceWorker.ready;
    return true;
  });
  expect(swReady).toBeTruthy();
});

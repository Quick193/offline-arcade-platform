import { expect, test } from '@playwright/test';
import { ensureOfflineReady, getTextState, openGame } from './helpers';

function squareToPoint(box: { x: number; y: number; width: number; height: number }, file: number, rank: number) {
  const size = Math.min(box.width * 0.78, box.height * 0.9);
  const startX = box.x + (box.width - size) / 2 - 30;
  const startY = box.y + (box.height - size) / 2;
  const cell = size / 8;
  return {
    x: startX + (file + 0.5) * cell,
    y: startY + (7 - rank + 0.5) * cell,
  };
}

test('chess boots, moves work, sw installs, offline works', async ({ page, context }) => {
  await page.goto('/');
  await openGame(page, 'Chess Pro');

  const canvas = page.locator('#game-canvas');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  if (!box) return;

  const e2 = squareToPoint(box, 4, 2);
  const e4 = squareToPoint(box, 4, 4);
  await page.mouse.click(e2.x, e2.y);
  await page.mouse.click(e4.x, e4.y);

  const state = await getTextState(page);
  expect(state.game).toBe('chess');
  expect(state.fen).toContain(' b ');

  await ensureOfflineReady(page, context);
  await openGame(page, 'Chess Pro');
  await expect(page.locator('#game-canvas')).toBeVisible();
});

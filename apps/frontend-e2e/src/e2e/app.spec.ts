import { expect, test } from '@playwright/test';

test('landing page renders in zoneless mode', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: /QuizForge Arcade Forge/i })).toBeVisible();

  const zoneValue = await page.evaluate(() => {
    return (globalThis as { Zone?: unknown }).Zone;
  });

  expect(zoneValue).toBeUndefined();
});

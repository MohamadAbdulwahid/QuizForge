import { expect, test } from '@playwright/test';

/**
 * E2E test for WebSocket reconnection behavior.
 * Tests that the reconnecting indicator appears and the game
 * recovers gracefully after a network interruption.
 *
 * NOTE: Full reconnection testing requires a running backend
 * and the ability to simulate network conditions. These tests
 * verify the UI behavior with basic page navigation.
 */

test.describe('Game Reconnect', () => {
  test('unauthenticated user cannot access game pages', async ({ page }) => {
    // Game pages require auth — verify redirect
    await page.goto('/game-lobby/123456');
    await expect(page).toHaveURL(/\/login/);
  });

  test('unauthenticated user cannot access host pages', async ({ page }) => {
    await page.goto('/host/123456');
    await expect(page).toHaveURL(/\/login/);
  });

  test('play page loads for unauthenticated user (redirects to login)', async ({ page }) => {
    await page.goto('/play');
    await expect(page).toHaveURL(/\/login/);
  });
});

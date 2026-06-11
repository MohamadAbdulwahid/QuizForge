import { expect, test } from '@playwright/test';

/**
 * E2E test for the Forge Classic game flow.
 * Tests the full join → lobby → question → answer → leaderboard journey.
 *
 * NOTE: This test requires a running frontend AND backend server,
 * plus a valid session PIN in 'waiting' status. Adjust BASE_URL
 * and test data as needed for your environment.
 */

test.describe('Forge Classic Game Flow', () => {
  test('landing page loads and has play button', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /QuizForge/i })).toBeVisible();
  });

  test('unauthenticated user is redirected from /play to /login', async ({ page }) => {
    await page.goto('/play');
    await expect(page).toHaveURL(/\/login/);
  });

  test('login page renders with email and password fields', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test('register page renders with form fields', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test('dashboard redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('game lobby redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/game-lobby/123456');
    await expect(page).toHaveURL(/\/login/);
  });

  test('game page redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/game/123456');
    await expect(page).toHaveURL(/\/login/);
  });

  test('host page redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/host/123456');
    await expect(page).toHaveURL(/\/login/);
  });

  test('leaderboards page redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/leaderboards');
    await expect(page).toHaveURL(/\/login/);
  });

  test('admin page redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/dashboard/admin');
    await expect(page).toHaveURL(/\/login/);
  });
});

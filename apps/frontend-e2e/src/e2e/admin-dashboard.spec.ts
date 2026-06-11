import { expect, test } from '@playwright/test';

/**
 * E2E test for the admin dashboard.
 * Tests that admin routes are properly protected and
 * the dashboard renders for authenticated admin users.
 *
 * NOTE: Full admin testing requires a running backend with
 * ADMIN_USER_IDS configured and a valid admin JWT. These tests
 * verify the unauthenticated access control behavior.
 */

test.describe('Admin Dashboard', () => {
  test('unauthenticated user is redirected from admin page', async ({ page }) => {
    await page.goto('/dashboard/admin');
    await expect(page).toHaveURL(/\/login/);
  });

  test('unauthenticated user is redirected from dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});

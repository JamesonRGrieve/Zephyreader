// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test } from '@playwright/test';

test.describe('OpenTeleprompt home', () => {
  test('renders the landing heading inside the framework shell', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Welcome to OpenTeleprompt' })).toBeVisible();
    // The framework shell provides the main content region the teleprompter scrolls.
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('shows the document loading state before the list resolves', async ({ page }) => {
    // Hold the document list request open so the loading state is observable.
    await page.route('**/google/docs/list', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.goto('/');
    await expect(page.getByText('Loading documents...')).toBeVisible();
  });
});

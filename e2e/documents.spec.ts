// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test } from '@playwright/test';

const MOCK_DOCS = [
  { id: 'doc-1', name: 'Opening Remarks', starred: true, modifiedTime: '2026-01-02T10:00:00Z', size: 4096 },
  { id: 'doc-2', name: 'Q1 Script', starred: false, modifiedTime: '2026-02-03T12:30:00Z', size: 8192 },
];

test.describe('document list -> teleprompter', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/google/docs/list', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_DOCS) }),
    );
    // The teleprompter fetches a single document's markdown when opened.
    await page.route(
      (url) => url.pathname.endsWith('/google/docs'),
      (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify('# Opening Remarks\n\nHello from the teleprompter.'),
        }),
    );
  });

  test('renders mocked documents as selectable rows', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('cell', { name: 'Opening Remarks' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Q1 Script' })).toBeVisible();
  });

  test('opening a document reveals the teleprompter control panel', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('cell', { name: 'Opening Remarks' }).click();
    await expect(page.getByText('Control Panel')).toBeVisible();
    // The selected document's markdown body renders inside the teleprompter.
    await expect(page.getByText('Hello from the teleprompter.')).toBeVisible();
  });
});

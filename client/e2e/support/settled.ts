// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, type Page } from '@playwright/test';

/** The pages' loading messages ("Loading your scripts…", "Connecting…"); each ends in an ellipsis. */
const LOADING = /^(Loading|Opening|Getting the prompter ready|Connecting)[^\n]*…$/;

/** Waits until the page shows its content rather than a loading state (a live stream never lets the network go idle). */
export async function settled(page: Page): Promise<void> {
  await page.waitForLoadState('load');
  await expect(page.getByText(LOADING)).toHaveCount(0);
}

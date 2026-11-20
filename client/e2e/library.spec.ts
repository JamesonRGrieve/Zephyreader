// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Writing, filing and presenting scripts, on both variants: the same journey a person
 * takes, through the pages, against the real back end.
 */
import { expect, test } from '@playwright/test';
import { signedInPerson, watchHosts } from './support/people';

const AUTOSAVED = 'Saved';

test('a new person writes a script, it saves itself, and they present it @phone', async ({ browser }, testInfo) => {
  const { page, context } = await signedInPerson(browser, testInfo);
  const hosts = watchHosts(page);
  await expect(page.getByText('No scripts yet')).toBeVisible();

  await page.getByRole('button', { name: 'New script' }).click();
  await page.waitForURL(/\/script\//);
  await page.getByLabel('Title').fill('Launch keynote');
  await page
    .getByLabel('Script', { exact: true })
    .fill('# Opening\n\nGood evening [smile] everyone.\n\nTonight we **launch** Zephyreader.');
  // It saves itself once typing pauses: unsaved first, then saved.
  await expect(page.getByText('Unsaved changes', { exact: false })).toBeVisible();
  await expect(page.getByText(`8 words · about 0:03 · ${AUTOSAVED}`, { exact: true })).toBeVisible();

  // It really saved: a reload shows it.
  await page.reload();
  await expect(page.getByLabel('Title')).toHaveValue('Launch keynote');
  await expect(page.getByLabel('Script', { exact: true })).toHaveValue(/Tonight we \*\*launch\*\* Zephyreader\./);

  await page.getByRole('link', { name: 'Present' }).click();
  await page.waitForURL(/\/present\//);
  const script = page.getByRole('region', { name: 'Script' }).or(page.getByLabel('Script', { exact: true }));
  await expect(script).toContainText('Good evening everyone.');
  // Cue notes never show on the prompter.
  await expect(script).not.toContainText('smile');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeVisible();

  const origin = new URL(testInfo.project.use.baseURL ?? '').host;
  const idp = '127.0.0.1:47100';
  expect([...hosts].filter((host) => host !== origin && host !== idp)).toEqual([]);
  await context.close();
});

test('folders, starring, moving, importing a file and deleting', async ({ browser }, testInfo) => {
  const { page, context } = await signedInPerson(browser, testInfo);

  await page.getByRole('button', { name: 'New folder' }).click();
  await page.getByLabel('Folder name').fill('Talks');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('navigation', { name: 'Folders' }).getByText('Talks')).toBeVisible();

  // Import a plain-text file as a script.
  await page.getByRole('button', { name: 'Import' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: /From a file/ }).click();
  await (
    await chooser
  ).setFiles({
    name: 'welcome_speech.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Welcome, everyone, and thank you for coming.'),
  });
  await page.waitForURL(/\/script\//);
  await expect(page.getByLabel('Title')).toHaveValue('welcome speech');
  await page.getByRole('link', { name: 'Your scripts' }).click();

  const row = page.getByRole('listitem').filter({ hasText: 'welcome speech' });
  await row.getByRole('button', { name: 'Star welcome speech' }).click();
  await expect(row.getByRole('button', { name: 'Unstar welcome speech' })).toBeVisible();

  await row.getByRole('button', { name: 'welcome speech actions' }).click();
  await page.getByRole('menuitem', { name: 'Move to' }).click();
  await page.getByRole('menuitem', { name: 'Talks' }).click();
  await page.getByRole('navigation', { name: 'Folders' }).getByRole('button', { name: /Talks/ }).first().click();
  await expect(page.getByRole('listitem').filter({ hasText: 'welcome speech' })).toBeVisible();

  // A delete takes effect on screen at once and can be taken back while its notice is up.
  // Within the scripts list: the Undo notice is a list item too, and names the script.
  const scriptRow = page.getByRole('region', { name: 'Scripts' }).getByRole('listitem').filter({ hasText: 'welcome speech' });
  const deleteIt = async () => {
    await scriptRow.getByRole('button', { name: 'welcome speech actions' }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await expect(scriptRow).toHaveCount(0);
  };
  await deleteIt();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(scriptRow).toBeVisible();

  // Left alone, it is deleted on the server once the notice has gone. Wait for that write itself:
  // a reload as soon as the timer fires could abort it.
  const deleted = page.waitForResponse(
    (response) => response.request().method() === 'DELETE' && response.url().includes('/v1/script/'),
    { timeout: 20_000 },
  );
  await deleteIt();
  expect((await deleted).ok()).toBe(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Your scripts' })).toBeVisible();
  await expect(scriptRow).toHaveCount(0);
  await context.close();
});

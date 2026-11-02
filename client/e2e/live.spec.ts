// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * One person's devices kept in step, on both variants: the phone remote drives the
 * display, a second display follows the first, and the follower can take the lead.
 */
import { expect, test } from '@playwright/test';
import { makeScript } from './support/api';
import { signedInPerson } from './support/people';

const LONG_SCRIPT = Array.from(
  { length: 60 },
  (_, index) => `Paragraph ${index + 1}: the speaker keeps talking about the launch.`,
).join('\n\n');

test('the remote starts and pauses the display, and a second display follows', async ({ browser }, testInfo) => {
  const person = await signedInPerson(browser, testInfo);
  const script = await makeScript(person.page, 'Remote test', LONG_SCRIPT);

  const display = person.page;
  await display.goto(`/present/${script.id}`);
  await expect(display.getByRole('button', { name: 'Start', exact: true })).toBeVisible();

  const remote = await person.context.newPage();
  await remote.goto(`/remote?script=${script.id}`);
  await expect(remote.getByText('Remote test')).toBeVisible();

  await remote.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(display.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await expect(remote.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await remote.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(display.getByRole('button', { name: 'Start', exact: true })).toBeVisible();

  // A second display follows the first one's position.
  const second = await person.context.newPage();
  await second.goto(`/present/${script.id}`);
  await expect(second.getByText('Following the leading display')).toBeVisible();
  await display.keyboard.press('PageDown');
  await display.keyboard.press('PageDown');
  const followed = second.getByLabel('Script', { exact: true });
  await expect.poll(async () => followed.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

  // It can take the lead.
  await second.getByRole('button', { name: 'Devices and remote' }).click();
  await second.getByRole('button', { name: 'Lead from this device' }).click();
  await expect(second.getByText('Following the leading display')).toHaveCount(0);
  await expect(display.getByText('Following the leading display')).toBeVisible();

  await person.context.close();
});

test('a display that joins late is put where the leader already is', async ({ browser }, testInfo) => {
  const person = await signedInPerson(browser, testInfo);
  const script = await makeScript(person.page, 'Late joiner', LONG_SCRIPT);
  const display = person.page;
  await display.goto(`/present/${script.id}`);
  await expect(display.getByRole('button', { name: 'Start', exact: true })).toBeVisible();
  const leader = display.getByLabel('Script', { exact: true });
  await display.keyboard.press('PageDown');
  await display.keyboard.press('PageDown');
  await expect.poll(async () => leader.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

  // The leader has stopped moving; the newcomer still ends up where it is.
  const late = await person.context.newPage();
  await late.goto(`/present/${script.id}`);
  await expect(late.getByText('Following the leading display')).toBeVisible();
  const follower = late.getByLabel('Script', { exact: true });
  await expect.poll(async () => follower.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await person.context.close();
});

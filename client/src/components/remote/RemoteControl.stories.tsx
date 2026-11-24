// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, within } from 'storybook/test';
import RemoteControl from './RemoteControl';

const meta: Meta<typeof RemoteControl> = {
  title: 'Remote/Remote control',
  component: RemoteControl,
  tags: ['autodocs'],
  args: { scriptId: 'script-keynote', apiBase: '/api', deviceId: 'story-phone', deviceLabel: 'Phone' },
  globals: { viewport: { value: 'mobile1', isRotated: false } },
};
export default meta;
type Story = StoryObj<typeof RemoteControl>;

/**
 * Before the live channel answers (Storybook has no back end, so it never does): it says it is
 * connecting, and every button is off. Connected and driving a prompter are covered by
 * RemoteControl.test.tsx and e2e/live.spec.ts.
 */
export const Connecting: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Connecting…')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Start' })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: 'Next cue' })).toBeDisabled();
  },
};

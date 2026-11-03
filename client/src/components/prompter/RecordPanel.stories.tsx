// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, fn, within } from 'storybook/test';
import RecordPanel from './RecordPanel';

const meta: Meta<typeof RecordPanel> = {
  title: 'Prompter/Record a take',
  component: RecordPanel,
  tags: ['autodocs'],
  args: { title: 'Launch keynote', canUpload: true, upload: fn(async () => undefined) },
};
export default meta;
type Story = StoryObj<typeof RecordPanel>;

/** Before recording, the empty preview says what will show there. */
export const Ready: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('What you record shows here once you start.')).toBeVisible();
    await expect(canvas.getByRole('button', { name: /Start recording/ })).toBeEnabled();
  },
};

/** Without the cloud library, a take downloads to the device only. */
export const DownloadOnly: Story = { args: { canUpload: false } };

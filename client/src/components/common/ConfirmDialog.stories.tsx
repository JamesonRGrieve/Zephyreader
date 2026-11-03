// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, fn, screen, userEvent } from 'storybook/test';
import ConfirmDialog from './ConfirmDialog';

const meta: Meta<typeof ConfirmDialog> = {
  title: 'Common/Confirm dialog',
  component: ConfirmDialog,
  tags: ['autodocs'],
  args: {
    open: true,
    title: 'Delete “Launch keynote”?',
    description: 'The script goes for good; your recordings of it stay.',
    confirm: 'Delete script',
    onConfirm: fn(),
    onClose: fn(),
  },
};
export default meta;
type Story = StoryObj<typeof ConfirmDialog>;

export const Confirming: Story = {
  play: async ({ args }) => {
    await userEvent.click(await screen.findByRole('button', { name: 'Delete script' }));
    await expect(args.onConfirm).toHaveBeenCalledOnce();
  },
};

export const Cancelling: Story = {
  play: async ({ args }) => {
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    await expect(args.onConfirm).not.toHaveBeenCalled();
    await expect(args.onClose).toHaveBeenCalled();
  },
};

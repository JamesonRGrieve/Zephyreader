// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, fn, screen, userEvent, waitFor } from 'storybook/test';
import NameDialog from './NameDialog';

const meta: Meta<typeof NameDialog> = {
  title: 'Common/Name dialog',
  component: NameDialog,
  tags: ['autodocs'],
  args: {
    open: true,
    title: 'New folder',
    label: 'Folder name',
    initial: '',
    confirm: 'Create folder',
    maxLength: 120,
    onSubmit: fn(),
    onClose: fn(),
  },
};
export default meta;
type Story = StoryObj<typeof NameDialog>;

export const Naming: Story = {
  play: async ({ args }) => {
    // The dialog fades in: wait until its field is shown and takes the pointer before typing.
    const name = await screen.findByLabelText('Folder name');
    await waitFor(() => {
      expect(name).toBeVisible();
      expect(getComputedStyle(name).pointerEvents).not.toBe('none');
    });
    await userEvent.type(name, 'Launch week');
    await userEvent.click(screen.getByRole('button', { name: 'Create folder' }));
    await expect(args.onSubmit).toHaveBeenCalledWith('Launch week');
  },
};

export const Renaming: Story = { args: { title: 'Rename folder', initial: 'Launch week', confirm: 'Rename' } };

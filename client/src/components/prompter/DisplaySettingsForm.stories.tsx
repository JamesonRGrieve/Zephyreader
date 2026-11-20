// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, fn, userEvent, within } from 'storybook/test';
import { DEFAULT_SETTINGS } from '~/features/prompter/settings';
import DisplaySettingsForm from './DisplaySettingsForm';

const meta: Meta<typeof DisplaySettingsForm> = {
  title: 'Prompter/Display settings',
  component: DisplaySettingsForm,
  tags: ['autodocs'],
  args: { settings: DEFAULT_SETTINGS, onChange: fn() },
};
export default meta;
type Story = StoryObj<typeof DisplaySettingsForm>;

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('switch', { name: 'All capitals' }));
    await expect(args.onChange).toHaveBeenCalledWith(expect.objectContaining({ allCaps: true }));
  },
};

/** A beam-splitter rig: mirrored both ways. */
export const Mirrored: Story = {
  args: { settings: { ...DEFAULT_SETTINGS, mirrorHorizontal: true, mirrorVertical: true } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('switch', { name: 'Mirror left to right' })).toBeChecked();
  },
};

/** Short choices are chips in one radio group: the current one is checked, and the arrow keys move between them. */
export const Chips: Story = {
  play: async ({ canvasElement, args }) => {
    const colours = within(within(canvasElement).getByRole('radiogroup', { name: 'Colours' }));
    await expect(colours.getByRole('radio', { name: 'White on black' })).toBeChecked();
    await userEvent.click(colours.getByRole('radio', { name: 'Yellow on black' }));
    await expect(args.onChange).toHaveBeenCalledWith(expect.objectContaining({ theme: 'high-contrast' }));
    colours.getByRole('radio', { name: 'White on black' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    await expect(colours.getByRole('radio', { name: 'Black on white' })).toHaveFocus();
  },
};

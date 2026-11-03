// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect } from 'storybook/test';
import { ZephyreaderLogo } from './ZephyreaderLogo';

const meta: Meta<typeof ZephyreaderLogo> = {
  title: 'Brand/Zephyreader logo',
  component: ZephyreaderLogo,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof ZephyreaderLogo>;

/** Decorative: the app's name always stands beside it, so it is hidden from screen readers. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('svg')).toHaveAttribute('aria-hidden');
  },
};

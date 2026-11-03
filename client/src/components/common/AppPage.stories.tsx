// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, within } from 'storybook/test';
import { SidebarProvider } from 'zephyrex/ui/sidebar';
import { AppPage } from './AppPage';

const meta: Meta<typeof AppPage> = {
  title: 'Common/App page',
  component: AppPage,
  tags: ['autodocs'],
  decorators: [(Story) => <SidebarProvider>{Story()}</SidebarProvider>],
  args: { title: 'Your scripts', children: <h1>Your scripts</h1> },
};
export default meta;
type Story = StoryObj<typeof AppPage>;

export const Wide: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('banner')).toHaveTextContent('Your scripts');
    await expect(canvas.getByRole('heading', { level: 1, name: 'Your scripts' })).toBeVisible();
  },
};

export const Narrow: Story = { args: { width: 'narrow', title: 'Remote control', children: <h1>Remote control</h1> } };

/**
 * The header carries the button that opens the navigation on a phone (CSS shows it below the
 * `md` width only, so it is looked for whatever the viewport the story runs at).
 */
export const Phone: Story = {
  globals: { viewport: { value: 'mobile1', isRotated: false } },
  play: async ({ canvasElement }) => {
    const header = within(within(canvasElement).getByRole('banner'));
    await expect(header.getByRole('button', { name: 'Toggle Sidebar', hidden: true })).toBeInTheDocument();
  },
};

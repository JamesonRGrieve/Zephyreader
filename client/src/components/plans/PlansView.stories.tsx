// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, within } from 'storybook/test';
import { ZephyrexProvider } from 'zephyrex';
import { SidebarProvider } from 'zephyrex/ui/sidebar';
import config from '~/zephyrex.config';
import PlansView from './PlansView';

const meta: Meta<typeof PlansView> = {
  title: 'Plans/Plans page',
  component: PlansView,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <ZephyrexProvider config={config}>
        <SidebarProvider>
          <Story />
        </SidebarProvider>
      </ZephyrexProvider>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof PlansView>;

/** Where plans are sold: waitlist only, no payment. */
export const Waitlist: Story = {
  args: { waitlist: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('heading', { name: 'Paid plans: waitlist only' })).toBeVisible();
  },
};

/** A server with no paid plans (lite). */
export const NoPlans: Story = { args: { waitlist: false } };

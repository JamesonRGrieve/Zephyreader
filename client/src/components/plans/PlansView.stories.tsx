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

/** The hosted service: accounts and paid plans are waitlist only, no payment. */
export const Waitlist: Story = {
  args: { waitlist: true },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('heading', { name: 'Accounts and paid plans: waitlist only' }),
    ).toBeVisible();
    await expect(within(canvasElement).getByRole('region', { name: 'Join the waitlist' })).toBeVisible();
  },
};

/** A server with no paid plans (lite). */
export const NoPlans: Story = { args: { waitlist: false } };

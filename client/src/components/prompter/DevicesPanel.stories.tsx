// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, fn, userEvent, within } from 'storybook/test';
import DevicesPanel from './DevicesPanel';

const meta: Meta<typeof DevicesPanel> = {
  title: 'Prompter/Devices and remote',
  component: DevicesPanel,
  tags: ['autodocs'],
  args: {
    devices: [
      { client_id: 'desk', label: 'Chrome on Windows', main: true, connected: true },
      { client_id: 'phone', label: 'Remote · Chrome on Android', main: false, connected: true },
    ],
    thisDevice: 'desk',
    isMain: true,
    connected: true,
    remoteHref: '/remote?script=script-keynote',
    onClaim: fn(),
  },
};
export default meta;
type Story = StoryObj<typeof DevicesPanel>;

/** This display leads: it is marked, and offers the remote, not the lead. */
export const Leading: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('This device')).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'Lead from this device' })).toBeNull();
    await expect(canvas.getByRole('link', { name: 'Open the remote control' })).toBeVisible();
  },
};

export const Following: Story = {
  args: { thisDevice: 'second', isMain: false },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Lead from this device' }));
    await expect(args.onClaim).toHaveBeenCalledOnce();
  },
};

export const Reconnecting: Story = {
  args: { connected: false },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('status')).toHaveTextContent('Reconnecting');
  },
};

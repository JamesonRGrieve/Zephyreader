// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, fn, userEvent, within } from 'storybook/test';
import WaitlistForm from './WaitlistForm';

const meta: Meta<typeof WaitlistForm> = {
  title: 'Plans/Waitlist form',
  component: WaitlistForm,
  tags: ['autodocs'],
  args: { join: fn(async () => undefined) },
};
export default meta;
type Story = StoryObj<typeof WaitlistForm>;

export const Empty: Story = {};

/** Joined: the form gives way to a confirmation. */
export const Joined: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Email'), 'ada@example.com');
    await userEvent.click(canvas.getByRole('button', { name: 'Join the waitlist' }));
    await expect(await canvas.findByRole('status')).toHaveTextContent("You're on the waitlist");
  },
};

/** The server refused: the reason shows and what was typed stays. */
export const Refused: Story = {
  args: {
    join: fn(async () => {
      throw new Error("We couldn't add you to the waitlist just now. Try again later.");
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Email'), 'ada@example.com');
    await userEvent.click(canvas.getByRole('button', { name: 'Join the waitlist' }));
    await expect(await canvas.findByRole('alert')).toBeVisible();
  },
};

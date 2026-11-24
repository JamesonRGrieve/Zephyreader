// SPDX-License-Identifier: AGPL-3.0-or-later
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import WaitlistForm from './WaitlistForm';

describe('WaitlistForm', () => {
  it('sends what was filled in, trimmed, with the plan chosen, then confirms', async () => {
    const join = vi.fn().mockResolvedValue(undefined);
    render(<WaitlistForm join={join} />);
    await userEvent.type(screen.getByLabelText('Email'), ' ada@example.com ');
    await userEvent.click(screen.getByLabelText('Team, shared with colleagues'));
    await userEvent.type(screen.getByLabelText(/What would you use it for/), 'Weekly all-hands');
    await userEvent.click(screen.getByRole('button', { name: 'Join the waitlist' }));
    expect(join).toHaveBeenCalledWith({
      email: 'ada@example.com',
      name: undefined,
      use: 'Weekly all-hands',
      plan: 'team',
    });
    expect(await screen.findByRole('status')).toHaveTextContent("You're on the waitlist");
  });

  it('asks for an email before sending anything', async () => {
    const join = vi.fn();
    render(<WaitlistForm join={join} />);
    await userEvent.click(screen.getByRole('button', { name: 'Join the waitlist' }));
    expect(join).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Email')).toBeInvalid();
  });

  it('keeps what was typed and says why when joining fails', async () => {
    const join = vi.fn().mockRejectedValue(new Error('Too many tries just now. Wait a minute and try again.'));
    render(<WaitlistForm join={join} />);
    await userEvent.type(screen.getByLabelText('Email'), 'ada@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Join the waitlist' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many tries just now.');
    expect(screen.getByLabelText('Email')).toHaveValue('ada@example.com');
  });

  it('says what the email is used for, and where to have it removed', () => {
    render(<WaitlistForm join={vi.fn()} />);
    expect(screen.getByText(/only to tell you when paid plans open/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'privacy@zephyrex.ca' })).toHaveAttribute('href', 'mailto:privacy@zephyrex.ca');
  });
});

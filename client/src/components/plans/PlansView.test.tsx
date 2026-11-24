// SPDX-License-Identifier: AGPL-3.0-or-later
import { render as renderBare, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { ZephyrexProvider } from 'zephyrex';
import { SidebarProvider } from 'zephyrex/ui/sidebar';
import config from '~/zephyrex.config';
import PlansView from './PlansView';

/** Inside the providers an app page renders in. */
const render = (ui: ReactElement) =>
  renderBare(
    <ZephyrexProvider config={config}>
      <SidebarProvider>{ui}</SidebarProvider>
    </ZephyrexProvider>,
  );

describe('PlansView', () => {
  it('says accounts and paid plans are waitlist only, takes no payment, and offers the waitlist', () => {
    render(<PlansView waitlist />);
    expect(screen.getByRole('heading', { name: 'Accounts and paid plans: waitlist only' })).toBeInTheDocument();
    expect(screen.getByText(/nothing here takes a payment/)).toBeInTheDocument();
    const join = screen.getByRole('region', { name: 'Join the waitlist' });
    expect(within(join).getByRole('textbox', { name: 'Email' })).toBeRequired();
    expect(within(join).getByRole('checkbox')).toBeRequired();
    expect(within(join).getByRole('link', { name: 'privacy policy' })).toHaveAttribute('href', '/docs/privacy');
    expect(within(join).getByRole('radio', { name: 'An account' })).toBeChecked();
  });

  it('starts a signed-in person on the Pro plan', () => {
    render(<PlansView waitlist initialInterest='pro' />);
    expect(screen.getByRole('radio', { name: 'Pro plan, for one person' })).toBeChecked();
  });

  it('says a server with no waitlist has no paid plans, and shows no form', () => {
    render(<PlansView waitlist={false} />);
    expect(screen.getByText('This server has no paid plans. Everything it offers is included.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Join the waitlist' })).not.toBeInTheDocument();
  });
});

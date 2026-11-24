// SPDX-License-Identifier: AGPL-3.0-or-later
import { render as renderBare, screen } from '@testing-library/react';
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
  it('says paid plans are waitlist only, takes no payment, and offers the waitlist', () => {
    render(<PlansView waitlist />);
    expect(screen.getByRole('heading', { name: 'Paid plans: waitlist only' })).toBeInTheDocument();
    expect(screen.getByText(/nothing here takes a payment/)).toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'Join the waitlist' })).toBeInTheDocument();
  });

  it('says a server with no waitlist has no paid plans, and shows no form', () => {
    render(<PlansView waitlist={false} />);
    expect(screen.getByText('This server has no paid plans. Everything it offers is included.')).toBeInTheDocument();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });
});

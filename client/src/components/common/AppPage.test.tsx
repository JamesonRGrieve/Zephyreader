// SPDX-License-Identifier: AGPL-3.0-or-later
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { ZephyrexProvider } from 'zephyrex';
import { SidebarProvider } from 'zephyrex/ui/sidebar';
import config from '~/zephyrex.config';
import { AppPage } from './AppPage';

/** The providers an app page renders inside (the path comes from the setup's next/navigation mock). */
function AtPath({ children }: { children: ReactNode }) {
  return (
    <ZephyrexProvider config={config}>
      <SidebarProvider>{children}</SidebarProvider>
    </ZephyrexProvider>
  );
}

describe('AppPage', () => {
  it('names the page in its header and holds the content at the width asked for', () => {
    render(
      <AtPath>
        <AppPage title='Prompter settings' width='medium'>
          <p>The settings</p>
        </AppPage>
      </AtPath>,
    );
    expect(screen.getByRole('banner')).toHaveTextContent('Prompter settings');
    expect(screen.getByText('The settings').parentElement).toHaveClass('max-w-3xl');
  });

  it('is wide unless told otherwise', () => {
    render(
      <AtPath>
        <AppPage title='Your scripts'>
          <p>The library</p>
        </AppPage>
      </AtPath>,
    );
    expect(screen.getByText('The library').parentElement).toHaveClass('max-w-6xl');
  });
});

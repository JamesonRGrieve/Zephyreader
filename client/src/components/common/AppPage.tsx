// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ReactNode } from 'react';
import { SidebarHeader, SidebarHeaderTitle } from 'zephyrex/components/appwrapper/src/SidebarHeader';
import { SidebarInset } from 'zephyrex/ui/sidebar';
import { cn } from '~/lib/utils';

const WIDTHS = { narrow: 'max-w-md', medium: 'max-w-3xl', wide: 'max-w-6xl' } as const;

/**
 * One of the app's pages: the framework's page header (the page's name, and on a phone the
 * button that opens the navigation) above the page's content, at a width that suits it.
 */
export function AppPage({
  title,
  width = 'wide',
  children,
}: {
  title: string;
  width?: keyof typeof WIDTHS;
  children: ReactNode;
}): ReactNode {
  return (
    <SidebarInset className='min-h-svh min-w-0'>
      <SidebarHeader>
        <SidebarHeaderTitle>{title}</SidebarHeaderTitle>
      </SidebarHeader>
      <div className={cn('mx-auto w-full min-w-0 px-4 pb-8 pt-2', WIDTHS[width])}>{children}</div>
    </SidebarInset>
  );
}

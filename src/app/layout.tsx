// SPDX-License-Identifier: AGPL-3.0-or-later
import Head from '@/components/appwrapper/src/Head';
import { SidebarContext } from '@/components/appwrapper/src/SidebarContext';
import { SidebarMain } from '@/components/appwrapper/src/SidebarMain';
import { ZephyrexApp } from 'zephyrex';
import '@zephyrex/zod2gql';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { cn } from '~/lib/utils';
import appConfig from '~/zephyrex.config';
import './globals.css';

export { metadata, viewport } from './metadata';

export default async function RootLayout({ children }: { children: ReactNode }): Promise<ReactNode> {
  const cookieStore = await cookies();
  const theme = cookieStore.get('theme')?.value ?? appConfig.app.defaultTheme ?? 'dark';
  const appearance = cookieStore.get('appearance')?.value ?? '';
  const htmlThemeClass = theme === 'dark' || theme === 'colorblind' || theme === 'colorblind-dark' ? theme : '';

  return (
    <html lang='en' className={htmlThemeClass} suppressHydrationWarning>
      <Head />
      <body className={cn(theme, appearance)}>
        <ZephyrexApp config={appConfig}>
          <SidebarMain side='left' />
          {children}
          <SidebarContext side='right' />
        </ZephyrexApp>
      </body>
    </html>
  );
}

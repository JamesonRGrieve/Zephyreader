// SPDX-License-Identifier: AGPL-3.0-or-later
import { cookies, headers } from 'next/headers';
import type { ReactNode } from 'react';
import { NONCE_HEADER } from 'zephyrex';
import { cn } from '~/lib/utils';
import appConfig from '~/zephyrex.config';
import { Providers } from './Providers';
import './globals.css';

export { metadata, viewport } from './metadata';

export default async function RootLayout({ children }: { children: ReactNode }): Promise<ReactNode> {
  // The framework's middleware sends a nonce-only CSP on every response; reading the nonce here
  // keeps every page rendered per request, so its scripts carry that response's nonce (a
  // statically rendered page would have all of them blocked).
  (await headers()).get(NONCE_HEADER);
  const cookieStore = await cookies();
  const theme = cookieStore.get('theme')?.value ?? appConfig.app.defaultTheme ?? 'dark';
  const appearance = cookieStore.get('appearance')?.value ?? '';
  const htmlThemeClass = theme === 'dark' || theme === 'colorblind' || theme === 'colorblind-dark' ? theme : '';

  return (
    <html lang='en' className={htmlThemeClass} suppressHydrationWarning>
      <body className={cn(theme, appearance)}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

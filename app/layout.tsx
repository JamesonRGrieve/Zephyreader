import type { Metadata } from 'next';
import { ThemeProvider } from '@/components/theme-provider';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import React, { ReactNode } from 'react';
import './globals.css';
import { ThemeToggle } from '@/components/theme-toggle';

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME,
  description: process.env.NEXT_PUBLIC_APP_DESCRIPTION,
};

export default function RootLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <html lang='en' suppressHydrationWarning>
      <body className={cn('min-h-screen bg-background text-foreground antialiased font-sans')}>
        <ThemeProvider attribute='class' defaultTheme='system' enableSystem disableTransitionOnChange>
          <div className='flex min-h-screen flex-col'>
            <header className='border-b bg-card/60 backdrop-blur'>
              <div className='container flex items-center justify-between gap-4 py-4'>
                <Link href='/' className='text-lg font-semibold tracking-tight'>
                  {process.env.NEXT_PUBLIC_APP_NAME ?? 'OpenTeleprompt'}
                </Link>
                <div className='flex items-center gap-2'>
                  <Link className='text-sm font-medium underline-offset-4 hover:underline' href='/user'>
                    Account
                  </Link>
                  <ThemeToggle />
                </div>
              </div>
            </header>
            <main className='container flex-1 py-8'>{children}</main>
            <footer className='border-t bg-card/60 py-6'>
              <div className='container flex items-center justify-between text-sm text-muted-foreground'>
                <span>&copy; {new Date().getFullYear()} OpenTeleprompt</span>
                <span>Stay focused and in control</span>
              </div>
            </footer>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}

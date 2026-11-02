// SPDX-License-Identifier: AGPL-3.0-or-later
import { Mic, MonitorPlay, Smartphone } from 'lucide-react';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { ZephyreaderLogo } from '~/brand/ZephyreaderLogo';
import { CSRF_COOKIE } from '~/lib/auth/sessionCookies';
import appConfig, { APP_NAME, LIBRARY_PATH } from '~/zephyrex.config';

const HIGHLIGHTS = [
  { icon: Mic, title: 'Follows your voice', text: 'The script scrolls as you speak and waits when you pause.' },
  { icon: Smartphone, title: 'Remote control', text: 'Drive the prompter from your phone, a pedal or a game controller.' },
  { icon: MonitorPlay, title: 'Record as you read', text: 'Record your camera or screen with the script in front of you.' },
];

/**
 * The landing page, for visitors. Someone signed in (the readable session cookie a sign-in
 * leaves, as the client's useHasSession reads it) goes straight to their scripts; a stale
 * cookie is caught there by the session check, which sends them to sign in.
 */
export default async function Home(): Promise<ReactNode> {
  if ((await cookies()).has(CSRF_COOKIE)) redirect(LIBRARY_PATH);
  const signIn = appConfig.auth?.authPath ?? '/user';

  return (
    <div className='flex min-h-svh w-full min-w-0 flex-col'>
      <header className='mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4'>
        <span className='flex items-center gap-2 text-lg font-semibold'>
          <ZephyreaderLogo />
          {APP_NAME}
        </span>
        <a href={signIn} className='text-sm font-medium hover:underline'>
          Sign in
        </a>
      </header>
      <main className='mx-auto flex w-full min-w-0 max-w-6xl flex-1 flex-col items-center gap-8 px-4 py-12 text-center'>
        <h1 className='text-4xl font-bold sm:text-5xl'>A teleprompter that keeps up with you</h1>
        <p className='text-muted-foreground max-w-2xl text-lg'>
          Write or import your script, then read it on any screen: scrolling at your pace, in time, or following your voice.
        </p>
        <a href={signIn} className='bg-primary text-primary-foreground rounded-md px-6 py-3 font-medium hover:opacity-90'>
          Sign in to start
        </a>
        <ul className='grid w-full gap-4 sm:grid-cols-3'>
          {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
            <li key={title} className='rounded-lg border p-5 text-left'>
              <Icon className='text-primary mb-3 h-6 w-6' aria-hidden />
              <h2 className='font-semibold'>{title}</h2>
              <p className='text-muted-foreground text-sm'>{text}</p>
            </li>
          ))}
        </ul>
        <p className='text-muted-foreground text-sm'>
          <Link href='/docs/privacy' className='underline'>
            Privacy policy
          </Link>
        </p>
      </main>
    </div>
  );
}

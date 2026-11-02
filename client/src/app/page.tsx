'use client';
// SPDX-License-Identifier: AGPL-3.0-or-later
import { Mic, MonitorPlay, Smartphone } from 'lucide-react';
import { useHasSession } from 'zephyrex';
import { SidebarInset } from 'zephyrex/ui/sidebar';
import LibraryPage from '~/components/library/LibraryPage';
import appConfig from '~/zephyrex.config';

const HIGHLIGHTS = [
  { icon: Mic, title: 'Follows your voice', text: 'The script scrolls as you speak and waits when you pause.' },
  { icon: Smartphone, title: 'Remote control', text: 'Drive the prompter from your phone, a pedal or a game controller.' },
  { icon: MonitorPlay, title: 'Record as you read', text: 'Record your camera or screen with the script in front of you.' },
];

export default function Home() {
  const signedIn = useHasSession();
  const signIn = appConfig.auth?.authPath ?? '/user';

  return (
    <SidebarInset className='min-h-svh'>
      <div className='mx-auto w-full min-w-0 max-w-6xl px-4 py-8'>
        {signedIn ? (
          <>
            <h1 className='mb-6 text-3xl font-bold'>Your scripts</h1>
            <LibraryPage />
          </>
        ) : (
          <div className='flex flex-col items-center gap-8 py-12 text-center'>
            <h1 className='text-4xl font-bold sm:text-5xl'>A teleprompter that keeps up with you</h1>
            <p className='text-muted-foreground max-w-2xl text-lg'>
              Write or import your script, then read it on any screen: scrolling at your pace, in time, or following your
              voice.
            </p>
            <a
              href={signIn}
              className='bg-primary text-primary-foreground rounded-md px-6 py-3 font-medium hover:opacity-90'
            >
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
          </div>
        )}
      </div>
    </SidebarInset>
  );
}

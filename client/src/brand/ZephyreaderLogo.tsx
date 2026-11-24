// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ReactElement } from 'react';

/**
 * Zephyreader's mark: a zephyr, three lines of wind that are lines of script; the line being read
 * curls in the accent. src/app/icon.svg is the same drawing in fixed colours, for the browser tab
 * and the installed app. Decorative: the app's name always stands beside it.
 */
export function ZephyreaderLogo(): ReactElement {
  return (
    <svg viewBox='0 0 32 32' className='size-8' aria-hidden>
      <rect width='32' height='32' rx='7' className='fill-primary' />
      <g fill='none' strokeWidth='2.4' strokeLinecap='round'>
        <path d='M6 10.5h12.5a3.2 3.2 0 1 0-3.2-3.2' className='stroke-primary-foreground' />
        <path d='M6 16h17a3.6 3.6 0 1 1-3.6 3.6' stroke='#FCD34D' />
        <path d='M6 21.5h8M6 26h5' className='stroke-primary-foreground' />
      </g>
    </svg>
  );
}

// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ReactElement } from 'react';

/**
 * Zephyreader's mark: three lines of script on the theme's accent, a pointer at the eye line
 * beside the middle one. src/app/icon.svg is the same drawing in fixed colours, for the
 * browser tab and the installed app. Decorative: the app's name always stands beside it.
 */
export function ZephyreaderLogo(): ReactElement {
  return (
    <svg viewBox='0 0 32 32' className='size-8' aria-hidden>
      <rect width='32' height='32' rx='7' className='fill-primary' />
      <g className='fill-primary-foreground'>
        <rect x='10' y='9.25' width='14' height='2.5' rx='1.25' opacity='0.55' />
        <path d='M5.5 13.5 9 16 5.5 18.5Z' />
        <rect x='10' y='14.75' width='16' height='2.5' rx='1.25' />
        <rect x='10' y='20.25' width='11' height='2.5' rx='1.25' opacity='0.55' />
      </g>
    </svg>
  );
}

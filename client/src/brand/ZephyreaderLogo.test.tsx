// SPDX-License-Identifier: AGPL-3.0-or-later
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ZephyreaderLogo } from './ZephyreaderLogo';

describe('ZephyreaderLogo', () => {
  it('is decorative: hidden from assistive technology, as the app’s name always stands beside it', () => {
    const { container } = render(<ZephyreaderLogo />);
    const mark = container.querySelector('svg');
    expect(mark).toHaveAttribute('aria-hidden', 'true');
    expect(mark).toHaveAttribute('viewBox', '0 0 32 32');
  });

  it('draws the tile and the lines of script in the theme’s colours', () => {
    const { container } = render(<ZephyreaderLogo />);
    expect(container.querySelector('rect')).toHaveClass('fill-primary');
    const lines = [...container.querySelectorAll('path')];
    expect(lines).toHaveLength(3);
    expect(lines.filter((line) => line.classList.contains('stroke-primary-foreground'))).toHaveLength(2);
  });

  it('curls the line being read in a fixed amber, so it holds in either theme', () => {
    const { container } = render(<ZephyreaderLogo />);
    const read = [...container.querySelectorAll('path')].filter((line) => line.getAttribute('stroke') === '#FCD34D');
    expect(read).toHaveLength(1);
  });
});

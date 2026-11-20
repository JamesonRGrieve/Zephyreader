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

  it('draws in the theme’s colours, not fixed ones', () => {
    const { container } = render(<ZephyreaderLogo />);
    expect(container.querySelector('rect')).toHaveClass('fill-primary');
    expect(container.querySelector('g')).toHaveClass('fill-primary-foreground');
  });
});

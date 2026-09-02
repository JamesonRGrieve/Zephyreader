// SPDX-License-Identifier: AGPL-3.0-or-later
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { getCookie } from 'cookies-next/client';
import type { ReactNode } from 'react';

// The framework shell and heavy children are out of scope for this unit.
vi.mock('zephyrex/ui/sidebar', () => ({
  SidebarInset: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('./DocumentList', () => ({ default: () => <div data-testid='doc-list' /> }));
vi.mock('./Teleprompter', () => ({ default: () => <div data-testid='teleprompter' /> }));

import Home from './page';

describe('Home', () => {
  it('shows a login prompt (and no document list) when there is no JWT cookie', () => {
    vi.mocked(getCookie).mockReturnValue(undefined);

    render(<Home />);

    expect(screen.getByText(/log in to load your documents/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /log in/i })).toBeInTheDocument();
    expect(screen.queryByTestId('doc-list')).not.toBeInTheDocument();
  });
});

// SPDX-License-Identifier: AGPL-3.0-or-later
import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  })),
  usePathname: vi.fn(() => '/'),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  redirect: vi.fn(),
}));

// The app reads the JS-readable zx_csrf session cookie via the client entrypoint.
vi.mock('cookies-next/client', () => ({
  getCookie: vi.fn(() => undefined),
  setCookie: vi.fn(),
  deleteCookie: vi.fn(),
}));

// jsdom's missing APIs (matchMedia, ResizeObserver, pointer capture, scrollIntoView) and clearing
// the toasts after each test come from the framework's setup, listed first in vitest.config.ts.

// SPDX-License-Identifier: AGPL-3.0-or-later
export {};

declare global {
  /** Runtime config injected by server-wrapper.js (production standalone server). */
  var __RUNTIME_CONFIG__: Record<string, string | undefined> | undefined;
}

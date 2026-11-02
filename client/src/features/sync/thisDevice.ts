// SPDX-License-Identifier: AGPL-3.0-or-later
'use client';
import { useSyncExternalStore } from 'react';
import { deviceId } from './liveChannel';

/** A short, readable name for this device in the devices list ("Firefox on Android"). */
export function deviceLabel(userAgent: string): string {
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /Firefox\//.test(userAgent)
      ? 'Firefox'
      : /Chrome\//.test(userAgent)
        ? 'Chrome'
        : /Safari\//.test(userAgent)
          ? 'Safari'
          : 'A browser';
  const system = /Android/.test(userAgent)
    ? 'Android'
    : /iPhone|iPad/.test(userAgent)
      ? 'iOS'
      : /Mac OS X/.test(userAgent)
        ? 'macOS'
        : /Windows/.test(userAgent)
          ? 'Windows'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : 'this device';
  return `${browser} on ${system}`;
}

let known: { id: string; label: string } | null = null;

/** This tab's device, worked out once (its id is kept in the tab's session storage). */
function thisDevice(): { id: string; label: string } {
  if (known === null) {
    let storage: Storage | null = null;
    try {
      storage = window.sessionStorage;
    } catch {
      storage = null;
    }
    known = { id: deviceId(storage, () => crypto.randomUUID()), label: deviceLabel(navigator.userAgent) };
  }
  return known;
}

const neverChanges = () => () => undefined;

/** This tab's device id and label in the browser; null while rendering on the server. */
export function useThisDevice(): { id: string; label: string } | null {
  return useSyncExternalStore(neverChanges, thisDevice, () => null);
}

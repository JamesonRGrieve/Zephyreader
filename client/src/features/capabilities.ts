// SPDX-License-Identifier: AGPL-3.0-or-later
'use client';
/**
 * What this deployment's back end can do, read from the back end itself: the same UI runs
 * on the lite and SaaS variants and never asks which one it is (docs/FEATURES.md).
 *
 * - A feature turns on when the extension serving it is listed (`GET /v1/extension`).
 * - Where the back end sells plans (the `entitlements` extension), a paid feature shows
 *   for everyone, unlocked by the user's plan or locked behind an upgrade prompt; a back
 *   end that sells none (lite) has no paid features to show.
 */
import { hasFeature, useEntitlement, useServerExtensions, type Entitlement } from 'zephyrex';

export const PAID_FEATURES = {
  aiWriter: 'ai_writer',
  captions: 'captions',
  cloudRecordings: 'cloud_recordings',
  serverVoice: 'server_voice',
  teamSharing: 'team_sharing',
} as const;

export type PaidFeature = (typeof PAID_FEATURES)[keyof typeof PAID_FEATURES];

export interface Capabilities {
  /** The back end's answer has arrived. */
  loaded: boolean;
  /** Several windows and devices kept in step (follower displays, phone remote). */
  liveSync: boolean;
  /** Importing from the user's Google Drive. */
  googleDrive: boolean;
  /** The back end sells plans, so paid features are offered (perhaps locked). */
  plans: boolean;
  /** Whether the user's plan unlocks `feature`. */
  unlocked: (feature: PaidFeature) => boolean;
}

export function capabilitiesOf(
  names: ReadonlySet<string>,
  entitlement: Entitlement | undefined,
  loaded: boolean,
): Capabilities {
  const plans = names.has('entitlements');
  return {
    loaded,
    liveSync: names.has('live_sync'),
    googleDrive: names.has('cloud') && names.has('oauth_consumer'),
    plans,
    unlocked: (feature) => plans && entitlement !== undefined && hasFeature(entitlement, feature),
  };
}

export function useCapabilities(): Capabilities {
  const extensions = useServerExtensions();
  const names = new Set((extensions.data ?? []).map((extension) => extension.name));
  const entitlement = useEntitlement();
  return capabilitiesOf(names, names.has('entitlements') ? entitlement.data : undefined, extensions.data !== undefined);
}

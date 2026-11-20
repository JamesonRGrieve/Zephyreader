// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Entitlement } from 'zephyrex';
import { describe, expect, it } from 'vitest';
import { capabilitiesOf, PAID_FEATURES } from './capabilities';

const PRO: Entitlement = {
  plan: 'pro',
  features: [PAID_FEATURES.captions, PAID_FEATURES.cloudRecordings],
  limits: {},
  seats: 1,
  seats_given: 0,
};

describe('capabilitiesOf', () => {
  it('turns a feature on when the back end runs the extension serving it', () => {
    const lite = capabilitiesOf(new Set(['live_sync']), undefined, true);
    expect(lite).toMatchObject({ loaded: true, liveSync: true, googleDrive: false, plans: false });
    // Drive needs both the cloud store and the Google sign-in it borrows.
    expect(capabilitiesOf(new Set(['cloud']), undefined, true).googleDrive).toBe(false);
    expect(capabilitiesOf(new Set(['cloud', 'oauth_consumer']), undefined, true).googleDrive).toBe(true);
  });

  it('unlocks a paid feature only where plans are sold and the plan includes it', () => {
    const saas = capabilitiesOf(new Set(['entitlements']), PRO, true);
    expect(saas.plans).toBe(true);
    expect(saas.unlocked(PAID_FEATURES.captions)).toBe(true);
    expect(saas.unlocked(PAID_FEATURES.teamSharing)).toBe(false);
  });

  it('unlocks nothing before the plan arrives, or where no plans are sold', () => {
    expect(capabilitiesOf(new Set(['entitlements']), undefined, true).unlocked(PAID_FEATURES.captions)).toBe(false);
    expect(capabilitiesOf(new Set(), PRO, true).unlocked(PAID_FEATURES.captions)).toBe(false);
  });

  it('says whether the back end has answered yet', () => {
    expect(capabilitiesOf(new Set(), undefined, false).loaded).toBe(false);
  });
});

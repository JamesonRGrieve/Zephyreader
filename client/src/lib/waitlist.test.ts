// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { WAITLIST_INTERESTS, waitlistSettings } from './waitlist';

describe('waitlistSettings', () => {
  it('is off unless the deployment names its web form', () => {
    expect(waitlistSettings({})).toBeUndefined();
    expect(waitlistSettings({ WAITLIST_WEB_FORM: '  ' })).toBeUndefined();
  });

  it('names the form, and the ERP only when one is given', () => {
    expect(waitlistSettings({ WAITLIST_WEB_FORM: 'waitlist-zephyreader' })).toEqual({ webForm: 'waitlist-zephyreader' });
    expect(waitlistSettings({ WAITLIST_WEB_FORM: 'f', WAITLIST_ERP_URL: 'https://erp.test/' })).toEqual({
      webForm: 'f',
      erpOrigin: 'https://erp.test',
    });
  });

  it('offers an account and the two paid plans', () => {
    expect(Object.keys(WAITLIST_INTERESTS)).toEqual(['account', 'pro', 'team']);
  });
});

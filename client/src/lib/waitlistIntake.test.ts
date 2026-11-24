// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it, vi } from 'vitest';
import { intakeConfig, IntakeError, leadOf, submitLead, WaitlistEntrySchema, WindowLimiter } from './waitlistIntake';

const NOW = new Date('2026-11-24T06:00:00Z');
const CONFIG = { erpUrl: 'https://erp.zephyrex.ca', webForm: 'waitlist-zephyreader' };

describe('the waitlist intake', () => {
  it('is off unless the deployment names its web form', () => {
    expect(intakeConfig({})).toBeUndefined();
    expect(intakeConfig({ WAITLIST_WEB_FORM: 'waitlist-zephyreader' })).toEqual(CONFIG);
    expect(intakeConfig({ WAITLIST_WEB_FORM: 'f', WAITLIST_ERP_URL: 'https://erp.test/' })?.erpUrl).toBe('https://erp.test');
  });

  it('takes an email and a plan, and refuses anything else', () => {
    expect(WaitlistEntrySchema.safeParse({ email: 'ada@example.com', plan: 'pro' }).success).toBe(true);
    expect(WaitlistEntrySchema.safeParse({ email: 'not an email', plan: 'pro' }).success).toBe(false);
    expect(WaitlistEntrySchema.safeParse({ email: 'ada@example.com', plan: 'gold' }).success).toBe(false);
    expect(WaitlistEntrySchema.safeParse({ email: 'ada@example.com', plan: 'pro', owner: 'x' }).success).toBe(false);
    expect(WaitlistEntrySchema.safeParse({ email: 'ada@example.com', plan: 'pro', use: 'x'.repeat(1001) }).success).toBe(
      false,
    );
  });

  it('makes a CRM Lead, splitting the name and putting the plan, use and consent in the enquiry', () => {
    const lead = leadOf(
      { email: 'ada@example.com', name: 'Ada King Lovelace', plan: 'team', use: 'Weekly all-hands' },
      'waitlist-zephyreader',
      NOW,
    );
    expect(lead).toMatchObject({
      doctype: 'CRM Lead',
      web_form_name: 'waitlist-zephyreader',
      first_name: 'Ada',
      last_name: 'King Lovelace',
      email: 'ada@example.com',
      source: 'Website',
      status: 'New',
      crm_business: 'Zephyrex',
    });
    expect(lead.enquiry).toMatch(/^Zephyreader waitlist: /);
    expect(lead.enquiry).toContain('Plan: Team.');
    expect(lead.enquiry).toContain("What they'd use it for: Weekly all-hands");
    expect(lead.enquiry).toContain('Consent (2026-11-24)');
  });

  it('names a lead with no name after the email’s local part', () => {
    const lead = leadOf({ email: 'ada.l@example.com', plan: 'unsure' }, 'f', NOW);
    expect(lead.first_name).toBe('ada.l');
    expect(lead).not.toHaveProperty('last_name');
  });

  it('posts the lead to the ERP’s web form, form-encoded', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 200 }));
    await submitLead({ email: 'ada@example.com', plan: 'pro' }, CONFIG, fetcher, NOW);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe('https://erp.zephyrex.ca/api/method/frappe.website.doctype.web_form.web_form.accept');
    const form = new URLSearchParams(String(init?.body));
    expect(form.get('web_form')).toBe('waitlist-zephyreader');
    expect(JSON.parse(form.get('data') ?? '')).toMatchObject({ doctype: 'CRM Lead', email: 'ada@example.com' });
  });

  it('says when the ERP refused or could not be reached', async () => {
    const refused = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 417 }));
    await expect(submitLead({ email: 'a@b.co', plan: 'pro' }, CONFIG, refused)).rejects.toThrow(IntakeError);
    const down = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('fetch failed'));
    await expect(submitLead({ email: 'a@b.co', plan: 'pro' }, CONFIG, down)).rejects.toThrow('could not be reached');
  });

  it('limits each key per window, and starts again in the next', () => {
    const limiter = new WindowLimiter(2, 1000);
    expect([limiter.take('a', 0), limiter.take('a', 1), limiter.take('a', 2), limiter.take('b', 2)]).toEqual([
      true,
      true,
      false,
      true,
    ]);
    expect(limiter.take('a', 1000)).toBe(true);
  });
});

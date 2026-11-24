// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The waitlist this server offers. Paid plans aren't on sale and sign-up is closed on the hosted
 * service, so a visitor leaves an email and becomes a lead in Zephyrex's CRM, through the ERP's web
 * form for this app (`waitlist-zephyreader`; SOP: Zephyrex Framework App Standards → Waitlist and
 * Sign-up Gate). A deployment names that form in WAITLIST_WEB_FORM; one that names none (lite)
 * has no waitlist.
 */

/**
 * What a person can wait for, by key, with the words the lead's enquiry carries
 * ("Zephyreader waitlist: Pro plan (pro)"). The route refuses any other key.
 */
export const WAITLIST_INTERESTS = {
  account: 'An account',
  pro: 'Pro plan, for one person',
  team: 'Team plan, shared with colleagues',
} as const satisfies Record<string, string>;
export type WaitlistInterest = keyof typeof WAITLIST_INTERESTS;

export interface WaitlistSettings {
  /** This app's web form in the ERP. */
  webForm: string;
  /** The ERP site, when it isn't Zephyrex's own (the e2e servers point it at nothing). */
  erpOrigin?: string;
}

/** The waitlist this deployment names, or none. Read per request: it is a runtime setting. */
export function waitlistSettings(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): WaitlistSettings | undefined {
  const webForm = environment.WAITLIST_WEB_FORM?.trim();
  if (!webForm) return undefined;
  const erp = environment.WAITLIST_ERP_URL?.trim().replace(/\/$/, '');
  return erp ? { webForm, erpOrigin: erp } : { webForm };
}

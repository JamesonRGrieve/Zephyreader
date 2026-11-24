// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The paid-plan waitlist's way into Zephyrex's CRM: a signup becomes a `CRM Lead` through the
 * ERP's guest Web Form for this app (Zephyrex ERP, 2026-11-24). The browser never talks to the
 * ERP: it posts to this app (/api/waitlist), and this server posts the lead on. A guest form needs
 * no key. Its hidden defaults are not applied to a server-side accept, so the lead's source,
 * status and business are sent with it.
 */
import { z } from 'zod';

/** The longest "what would you use it for" taken. */
export const USE_MAX_LENGTH = 1000;
/** What the form told the person their email is for: recorded with the lead as their consent. */
export const CONSENT_WORDING = 'We use your email only to tell you when paid plans open.';
const PLAN_NAMES = { pro: 'Pro', team: 'Team', unsure: 'Not sure yet' } as const;

export const WaitlistEntrySchema = z.strictObject({
  email: z.email().max(254),
  name: z.string().trim().max(140).optional(),
  plan: z.enum(['pro', 'team', 'unsure']),
  use: z.string().trim().max(USE_MAX_LENGTH).optional(),
});
export type WaitlistEntry = z.infer<typeof WaitlistEntrySchema>;

export interface IntakeConfig {
  /** The ERP site, e.g. https://erp.zephyrex.ca. */
  erpUrl: string;
  /** This app's guest Web Form on it, e.g. waitlist-zephyreader. */
  webForm: string;
}

/** The intake this deployment names, or none: a server without one (lite) has no waitlist. */
export function intakeConfig(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): IntakeConfig | undefined {
  const webForm = environment.WAITLIST_WEB_FORM;
  if (!webForm) return undefined;
  return { erpUrl: (environment.WAITLIST_ERP_URL || 'https://erp.zephyrex.ca').replace(/\/$/, ''), webForm };
}

/** The CRM Lead a signup becomes: names split, and the plan, use and consent in the enquiry. */
export function leadOf(entry: WaitlistEntry, webForm: string, now: Date): Record<string, string> {
  const [first, ...rest] = (entry.name || entry.email.split('@')[0]).split(/\s+/);
  const enquiry = [
    `Zephyreader waitlist: paid plans. Plan: ${PLAN_NAMES[entry.plan]}.`,
    entry.use ? `What they'd use it for: ${entry.use}` : undefined,
    `Consent (${now.toISOString().slice(0, 10)}): joined the waitlist on a form that said "${CONSENT_WORDING}"`,
  ]
    .filter(Boolean)
    .join('\n');
  return {
    doctype: 'CRM Lead',
    web_form_name: webForm,
    first_name: first,
    ...(rest.length > 0 ? { last_name: rest.join(' ') } : {}),
    email: entry.email,
    enquiry,
    source: 'Website',
    status: 'New',
    crm_business: 'Zephyrex',
  };
}

/** Thrown when the ERP did not take the lead (it is unreachable, or refused it). */
export class IntakeError extends Error {}

/** Posts the lead to the ERP's Web Form, server to server. */
export async function submitLead(
  entry: WaitlistEntry,
  config: IntakeConfig,
  fetcher: typeof fetch = fetch,
  now: Date = new Date(),
): Promise<void> {
  const body = new URLSearchParams({
    web_form: config.webForm,
    data: JSON.stringify(leadOf(entry, config.webForm, now)),
  });
  let response: Response;
  try {
    response = await fetcher(`${config.erpUrl}/api/method/frappe.website.doctype.web_form.web_form.accept`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    throw new IntakeError(`The ERP could not be reached: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!response.ok) throw new IntakeError(`The ERP refused the lead: HTTP ${response.status}`);
}

/**
 * A fixed-window count per key, in this process: a few signups per visitor and a ceiling for
 * everyone, so a script can't flood the CRM through this server.
 */
export class WindowLimiter {
  private readonly counts = new Map<string, { start: number; count: number }>();
  private readonly limit: number;
  private readonly windowMs: number;

  constructor(limit: number, windowMs: number) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  /** Counts one more for `key`; false once it is over the limit this window. */
  take(key: string, now: number = Date.now()): boolean {
    const seen = this.counts.get(key);
    if (seen === undefined || now - seen.start >= this.windowMs) {
      if (this.counts.size > 10_000) this.counts.clear();
      this.counts.set(key, { start: now, count: 1 });
      return true;
    }
    seen.count += 1;
    return seen.count <= this.limit;
  }
}

// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * A day as the reader's locale writes it in words ("Nov 2, 2026", "2 Nov 2026"): never the
 * all-number form, which reads as a different day to someone who puts the day first.
 */
export function formatDay(date: Date, locale?: string): string {
  return date.toLocaleDateString(locale, { dateStyle: 'medium' });
}

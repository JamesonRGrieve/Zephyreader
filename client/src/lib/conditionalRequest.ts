// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Optimistic-concurrency preconditions (RFC 9110 §13.1.1), in parity with
 * server-framework's stale-save contract: a row's entity tag is its serialised
 * `updated_at`, quoted, strong and opaque, and an unsafe write that names a stale
 * tag in `If-Match` is refused with 412 rather than overwriting a newer edit.
 */

/** RFC 9110 entity-tag: optional weak prefix, then a quoted run of etagc. */
const ENTITY_TAG = /^\s*(W\/)?"([\x21\x23-\x7E\x80-\xFF]*)"\s*(?:,|$)/;

export type IfMatchResult = 'absent' | 'match' | 'mismatch';

/**
 * The `updated_at` to stamp on a write: now, but always strictly after the row's
 * previous stamp, so two saves inside one clock tick still get distinct tags.
 */
export function nextUpdateStamp(previous: Date, now: Date = new Date()): Date {
  return new Date(Math.max(now.getTime(), previous.getTime() + 1));
}

/** The strong entity tag for a validator string: the string itself, quoted. */
export function entityTag(validator: string): string {
  return `"${validator}"`;
}

/**
 * Evaluates `If-Match` against the current validator using strong comparison:
 * `*` matches any current representation, a weak tag never matches, and a
 * malformed header matches nothing.
 */
export function evaluateIfMatch(header: string | null, currentValidator: string): IfMatchResult {
  if (header === null || header.trim() === '') return 'absent';
  if (header.trim() === '*') return 'match';
  let rest = header;
  while (rest.trim() !== '') {
    const tag = ENTITY_TAG.exec(rest);
    if (tag === null) return 'mismatch';
    if (tag[1] === undefined && tag[2] === currentValidator) return 'match';
    rest = rest.slice(tag[0].length);
  }
  return 'mismatch';
}

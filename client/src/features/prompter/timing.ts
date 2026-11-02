// SPDX-License-Identifier: AGPL-3.0-or-later
/** Scroll speeds and reading progress. Distances are pixels; times are seconds. */

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
/** A timed scroll never crawls slower than this, so a nearly-finished script still moves. */
export const MIN_TIMED_SPEED = 1;

/**
 * How far apart the spoken words sit in this layout, on average, from where each one is
 * (`wordOffsets`, top to bottom). Zero with fewer than two words.
 */
export function pixelsPerWord(wordOffsets: readonly number[]): number {
  const first = wordOffsets.at(0);
  const last = wordOffsets.at(-1);
  if (first === undefined || last === undefined || wordOffsets.length < 2) return 0;
  return (last - first) / (wordOffsets.length - 1);
}

/**
 * Pixels a second that read `wordsPerMinute` words a minute in a layout `wordSpacing` pixels a
 * word apart: so a speed reads the same on a wide desktop and a narrow phone.
 */
export function scrollPace(wordsPerMinute: number, wordSpacing: number): number {
  return (wordsPerMinute / SECONDS_PER_MINUTE) * wordSpacing;
}

/** The speed that covers `remaining` pixels in `secondsLeft` seconds (timed mode). */
export function timedSpeed(remaining: number, secondsLeft: number): number {
  if (remaining <= 0) return 0;
  if (secondsLeft <= 0) return remaining;
  return Math.max(MIN_TIMED_SPEED, remaining / secondsLeft);
}

/** How far through the script the reader is, from 0 to 1. */
export function progress(scrolled: number, scrollable: number): number {
  if (scrollable <= 0) return 1;
  return Math.min(1, Math.max(0, scrolled / scrollable));
}

/** Seconds left at `speed` pixels a second; null when not moving. */
export function secondsLeft(remaining: number, speed: number): number | null {
  if (speed <= 0) return null;
  return Math.max(0, remaining / speed);
}

/** Words read a minute so far; null until there is enough to say. */
export function wordsPerMinute(wordsRead: number, elapsedSeconds: number): number | null {
  if (elapsedSeconds < 1 || wordsRead < 1) return null;
  return Math.round((wordsRead / elapsedSeconds) * SECONDS_PER_MINUTE);
}

/** `seconds` as m:ss, or h:mm:ss from an hour. */
export function clock(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  const hours = Math.floor(whole / SECONDS_PER_HOUR);
  const minutes = Math.floor((whole % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const secs = String(whole % SECONDS_PER_MINUTE).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${secs}` : `${minutes}:${secs}`;
}

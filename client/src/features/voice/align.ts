// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Voice-follow: where in the script the speaker is, from the words a speech engine heard.
 *
 * The aligner keeps a position (a word index) and, for each batch of heard words, looks
 * for where they best match the script within a window around it: a little behind (the
 * speaker went back), further ahead (they read on). Words match when they are close
 * enough after normalising (case, punctuation, a few spelling slips), so recognition
 * errors don't stop the scroll. When nothing matches well (an ad-lib), the position stays.
 */

/** How far back and ahead of the current word a match is looked for. */
export const LOOK_BEHIND = 12;
export const LOOK_AHEAD = 40;
/** The most recent heard words compared at once. */
export const PHRASE_LENGTH = 6;
/** How alike two words must be (0-1) to count as the same word. */
export const WORD_SIMILARITY = 0.75;
/** The share of a phrase that must match for the position to move. */
export const MIN_PHRASE_SCORE = 0.5;
/** A match behind the position must beat one ahead by this much (reading on is likelier). */
const BACKWARD_PENALTY = 0.15;

export function normalise(word: string): string {
  return word
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}']+/gu, '')
    .replace(/'/g, '');
}

/** Levenshtein similarity of two words, from 0 (unlike) to 1 (equal). */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a === '' || b === '') return 0;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current.push(Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost));
    }
    previous = current;
  }
  return 1 - previous[b.length] / Math.max(a.length, b.length);
}

export class VoiceAligner {
  private readonly script: string[];
  private heard: string[] = [];
  private current = 0;

  constructor(words: readonly string[]) {
    this.script = words.map(normalise);
  }

  get position(): number {
    return this.current;
  }

  /** Moves the position (the scroll was moved by hand, or jumped to a cue). */
  seek(wordIndex: number): void {
    this.current = Math.min(Math.max(0, wordIndex), Math.max(0, this.script.length - 1));
    this.heard = [];
  }

  /**
   * How many heard words ending at `heardIndex` say `scriptWord`: 1 for one word, 2 when the
   * engine split it in two ("zephyr reader" for "Zephyreader"), 0 when they don't.
   */
  private static consumed(phrase: string[], heardIndex: number, scriptWord: string): number {
    if (similarity(phrase[heardIndex], scriptWord) >= WORD_SIMILARITY) return 1;
    if (heardIndex > 0 && similarity(phrase[heardIndex - 1] + phrase[heardIndex], scriptWord) >= WORD_SIMILARITY) {
      return 2;
    }
    return 0;
  }

  /** How well `phrase` matches the script ending at `end`, from 0 to 1. */
  private score(phrase: string[], end: number): number {
    // The speaker is at `end` only if the last words heard say that word.
    if (VoiceAligner.consumed(phrase, phrase.length - 1, this.script[end]) === 0) return 0;
    let matched = 0;
    let heardIndex = phrase.length - 1;
    let scriptIndex = end;
    while (heardIndex >= 0 && scriptIndex >= 0) {
      const here = VoiceAligner.consumed(phrase, heardIndex, this.script[scriptIndex]);
      if (here > 0) {
        matched += here;
        heardIndex -= here;
        scriptIndex -= 1;
      } else if (scriptIndex > 0 && VoiceAligner.consumed(phrase, heardIndex, this.script[scriptIndex - 1]) > 0) {
        // The engine missed a script word: skip it.
        scriptIndex -= 1;
      } else {
        heardIndex -= 1;
      }
    }
    return matched / phrase.length;
  }

  /**
   * Takes newly heard words (a final result, or the latest partial one) and returns the
   * position: the index of the last script word the speaker reached.
   */
  hear(words: readonly string[]): number {
    const fresh = words.map(normalise).filter((word) => word !== '');
    if (fresh.length === 0 || this.script.length === 0) return this.current;
    this.heard = [...this.heard, ...fresh].slice(-PHRASE_LENGTH);
    const from = Math.max(0, this.current - LOOK_BEHIND);
    const to = Math.min(this.script.length - 1, this.current + LOOK_AHEAD);
    let best = { index: this.current, score: 0 };
    for (let end = from; end <= to; end += 1) {
      const raw = this.score(this.heard, end);
      const score = end < this.current ? raw - BACKWARD_PENALTY : raw;
      if (
        score > best.score ||
        (score === best.score && Math.abs(end - this.current) < Math.abs(best.index - this.current))
      ) {
        best = { index: end, score };
      }
    }
    if (best.score >= MIN_PHRASE_SCORE) this.current = best.index;
    return this.current;
  }
}

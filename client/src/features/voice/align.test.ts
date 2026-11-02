// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { normalise, similarity, VoiceAligner } from './align';

const SCRIPT = (
  'Good evening everyone. Tonight we launch Zephyreader, a teleprompter that follows your voice. ' +
  'It scrolls when you speak and waits when you pause. Let me show you how it works. ' +
  'First, open a script from your library. Then press present and start talking.'
).split(' ');

const index = (word: string, from = 0) => SCRIPT.findIndex((candidate, at) => at >= from && normalise(candidate) === word);

describe('normalise and similarity', () => {
  it('ignores case, punctuation and accents', () => {
    expect(normalise('Zephyreader,')).toBe('zephyreader');
    expect(normalise("Don't")).toBe('dont');
    expect(normalise('Café')).toBe('cafe');
  });

  it('scores spelling slips as alike and different words as not', () => {
    expect(similarity('teleprompter', 'teleprompters')).toBeGreaterThan(0.9);
    expect(similarity('launch', 'lunch')).toBeGreaterThanOrEqual(0.75);
    expect(similarity('voice', 'script')).toBeLessThan(0.5);
  });
});

describe('VoiceAligner', () => {
  it('follows the speaker word by word through recognition slips', () => {
    const aligner = new VoiceAligner(SCRIPT);
    aligner.hear(['good', 'evening', 'everyone']);
    expect(aligner.position).toBe(index('everyone'));
    // "zephyr reader" and "lunch" are typical recognition errors.
    aligner.hear(['tonight', 'we', 'lunch', 'zephyr', 'reader']);
    expect(aligner.position).toBeGreaterThanOrEqual(index('launch'));
    aligner.hear(['a', 'teleprompter', 'that', 'follows', 'your', 'voice']);
    expect(aligner.position).toBe(index('voice'));
  });

  it('skips a word the engine missed', () => {
    const aligner = new VoiceAligner(SCRIPT);
    aligner.hear(['it', 'scrolls', 'when', 'speak', 'and', 'waits']);
    expect(aligner.position).toBe(index('waits'));
  });

  it('stays put during an ad-lib', () => {
    const aligner = new VoiceAligner(SCRIPT);
    aligner.hear(['good', 'evening', 'everyone']);
    const before = aligner.position;
    aligner.hear(['sorry', 'the', 'microphone', 'was', 'muted', 'earlier']);
    expect(aligner.position).toBe(before);
  });

  it('follows the speaker back when they repeat a sentence', () => {
    const aligner = new VoiceAligner(SCRIPT);
    aligner.seek(index('pause'));
    aligner.hear(['it', 'scrolls', 'when', 'you', 'speak']);
    expect(aligner.position).toBe(index('speak'));
  });

  it('reads on rather than back when a phrase appears twice', () => {
    const aligner = new VoiceAligner(SCRIPT);
    aligner.seek(index('works.'));
    aligner.hear(['from', 'your', 'library']);
    expect(aligner.position).toBe(index('library'));
  });

  it('seeks when the scroll is moved by hand, and handles an empty script', () => {
    const aligner = new VoiceAligner(SCRIPT);
    aligner.seek(10_000);
    expect(aligner.position).toBe(SCRIPT.length - 1);
    expect(new VoiceAligner([]).hear(['hello'])).toBe(0);
  });
});

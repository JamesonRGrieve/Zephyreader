// @vitest-environment node
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { clock, pixelsPerWord, progress, scrollPace, secondsLeft, timedSpeed, wordsPerMinute } from './timing';

describe('timing', () => {
  it('scrolls at a reading speed, whatever the screen makes of the words', () => {
    // 120 words a minute is 2 words a second; at 50 px a word that is 100 px a second.
    expect(scrollPace(120, pixelsPerWord([0, 50, 100, 150, 200]))).toBe(100);
    // The same words laid out twice as tall (a narrow phone): twice the pixels, the same pace of reading.
    expect(scrollPace(120, pixelsPerWord([0, 100, 200, 300, 400]))).toBe(200);
    // One word or none: nothing to scroll between.
    expect(pixelsPerWord([0])).toBe(0);
    expect(pixelsPerWord([])).toBe(0);
  });

  it('fits the remaining distance to the remaining time', () => {
    expect(timedSpeed(6000, 120)).toBe(50);
    expect(timedSpeed(0, 120)).toBe(0);
    expect(timedSpeed(10, 1000)).toBe(1);
  });

  it('reports progress, time left and pace', () => {
    expect(progress(250, 1000)).toBe(0.25);
    expect(progress(5, 0)).toBe(1);
    expect(secondsLeft(600, 60)).toBe(10);
    expect(secondsLeft(600, 0)).toBeNull();
    expect(wordsPerMinute(75, 30)).toBe(150);
    expect(clock(65)).toBe('1:05');
    expect(clock(3725)).toBe('1:02:05');
  });
});

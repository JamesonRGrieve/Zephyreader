// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { adjacentCue, prepareScript, readingSeconds, spokenWordCount } from './script';
import { colours, DEFAULT_SETTINGS, mirrorTransform, readSettings } from './settings';
import { clock, pixelsPerWord, progress, scrollPace, secondsLeft, timedSpeed, wordsPerMinute } from './timing';

const SCRIPT = `# Opening

Good evening [smile, pause] everyone.
Tonight we **launch** Zephyreader.

[slide 2]
It reads *your* script ==exactly== as written.

## Close
Thank you.`;

describe('prepareScript', () => {
  const prepared = prepareScript(SCRIPT);

  it('leaves cue notes out of the spoken words', () => {
    expect(prepared.words).toEqual([
      'Opening',
      'Good',
      'evening',
      'everyone.',
      'Tonight',
      'we',
      'launch',
      'Zephyreader.',
      'It',
      'reads',
      'your',
      'script',
      'exactly',
      'as',
      'written.',
      'Close',
      'Thank',
      'you.',
    ]);
  });

  it('makes headings and cue notes cue points', () => {
    // "Opening", "Good" (after [smile, pause]), "It" (after [slide 2]), "Close".
    expect(prepared.cues).toEqual([0, 1, 8, 15]);
    expect(prepared.blocks.map((block) => [block.kind, block.cue])).toEqual([
      ['heading', true],
      ['paragraph', true],
      ['paragraph', true],
      ['heading', true],
      ['paragraph', false],
    ]);
  });

  it('joins a paragraph’s lines into one block and keeps word styles', () => {
    const paragraph = prepared.blocks[1];
    expect(paragraph.words.map((word) => word.text).join(' ')).toBe('Good evening everyone. Tonight we launch Zephyreader.');
    const styles = Object.fromEntries(
      prepared.blocks.flatMap((block) => block.words).map((word) => [word.text, word.style]),
    );
    expect(styles).toMatchObject({ launch: 'bold', your: 'italic', exactly: 'highlight', reads: 'plain' });
  });

  it('jumps between cue points and to the ends', () => {
    expect(adjacentCue(prepared.cues, 5, 'next', 17)).toBe(8);
    expect(adjacentCue(prepared.cues, 5, 'previous', 17)).toBe(1);
    expect(adjacentCue(prepared.cues, 16, 'next', 17)).toBe(17);
    expect(adjacentCue(prepared.cues, 0, 'previous', 17)).toBe(0);
  });

  it('counts spoken words and reading time without cue notes', () => {
    expect(spokenWordCount('Hello [wave] there friends')).toBe(3);
    expect(spokenWordCount('  ')).toBe(0);
    // The same script the server's word_count test counts (EP_Teleprompter_test.py): 9.
    expect(
      spokenWordCount(
        '# Opening\n\nGood evening [smile, pause] everyone.\n\nTonight we **launch** ==Zephyreader== - *today*.',
      ),
    ).toBe(9);
    expect(readingSeconds(300, 150)).toBe(120);
  });
});

describe('settings', () => {
  it('keeps one pace, in words a minute, for scrolling and for time estimates', () => {
    expect(DEFAULT_SETTINGS.speed).toBe(150);
    expect(readSettings({ readingWpm: 200 })).not.toHaveProperty('readingWpm');
  });

  it('reads stored settings leniently: defaults for missing, invalid or unknown values', () => {
    const read = readSettings({ fontSize: 9999, theme: 'neon', speed: 120, mystery: true });
    expect(read.fontSize).toBe(DEFAULT_SETTINGS.fontSize);
    expect(read.theme).toBe('dark');
    expect(read.speed).toBe(120);
    expect('mystery' in read).toBe(false);
    expect(readSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it('draws custom colours only for the custom theme, and mirrors either way', () => {
    expect(colours({ ...DEFAULT_SETTINGS, theme: 'high-contrast' })).toEqual({ text: '#ffe600', background: '#000000' });
    expect(colours({ ...DEFAULT_SETTINGS, theme: 'custom', textColour: '#00ff00', backgroundColour: '#101010' })).toEqual({
      text: '#00ff00',
      background: '#101010',
    });
    expect(mirrorTransform({ ...DEFAULT_SETTINGS, mirrorHorizontal: true })).toBe('scale(-1, 1)');
  });
});

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

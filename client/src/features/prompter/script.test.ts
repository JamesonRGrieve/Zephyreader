// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { adjacentCue, prepareScript, readingSeconds, spokenWordCount } from './script';

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

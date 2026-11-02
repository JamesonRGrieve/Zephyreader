// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * A script as the prompter shows it. Scripts are Markdown with two prompter rules:
 *
 * - `[cue notes]` are for the presenter while editing and never show on the prompter;
 *   each one marks a cue point the prompter can jump between.
 * - Headings start a section (also a cue point); `**bold**`, `*italic*` and
 *   `==highlight==` style the words they wrap.
 *
 * Every spoken word gets an index, which voice-follow scrolling matches speech against
 * and the reading-line highlight follows.
 */

export type WordStyle = 'plain' | 'bold' | 'italic' | 'highlight';

export interface PrompterWord {
  /** Position among the script's spoken words, from 0. */
  index: number;
  text: string;
  style: WordStyle;
}

export interface PrompterBlock {
  kind: 'heading' | 'paragraph';
  words: PrompterWord[];
  /** Whether the block starts at a cue point (a heading, or a cue note before it). */
  cue: boolean;
}

export interface PreparedScript {
  blocks: PrompterBlock[];
  /** Every spoken word, in order (what voice-follow matches against). */
  words: string[];
  /** Word indexes that start a cue point, ascending. */
  cues: number[];
}

const CUE_NOTE = /\[[^\]\n]*\]/g;
const HEADING = /^#{1,6}\s+/;
const STYLE_MARKERS: [RegExp, WordStyle][] = [
  [/\*\*([^*]+)\*\*/g, 'bold'],
  [/==([^=]+)==/g, 'highlight'],
  [/(?<![*\w])\*([^*]+)\*(?![*\w])/g, 'italic'],
  [/(?<![_\w])_([^_]+)_(?![_\w])/g, 'italic'],
];
// Private-use characters fence a styled run while the line is split into words.
const RUN_START = '';
const RUN_END = '';
const STYLE_CODES: Record<WordStyle, string> = { plain: '', bold: 'b', italic: 'i', highlight: 'h' };
const CODE_STYLES: Record<string, WordStyle> = { b: 'bold', i: 'italic', h: 'highlight' };
const WORDS_PER_MINUTE_DEFAULT = 150;
const SECONDS_PER_MINUTE = 60;

/**
 * Spoken words in `text`: cue notes, heading marks and emphasis markers left out, and only
 * tokens with a letter or digit counted. The server keeps the same count (word_count, in
 * server/extensions/teleprompter and lib/teleprompterRecords.ts), so the editor and the
 * library always agree.
 */
export function spokenWordCount(text: string): number {
  return text
    .replace(CUE_NOTE, ' ')
    .replace(/^#{1,6}\s+/gm, ' ')
    .replace(/\*\*|==|[*_]/g, '')
    .split(/\s+/)
    .filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
}

/** How long reading `wordCount` words takes at `wordsPerMinute`, in seconds. */
export function readingSeconds(wordCount: number, wordsPerMinute: number = WORDS_PER_MINUTE_DEFAULT): number {
  return Math.round((wordCount / wordsPerMinute) * SECONDS_PER_MINUTE);
}

function styledWords(line: string): { text: string; style: WordStyle }[] {
  let marked = line;
  for (const [pattern, style] of STYLE_MARKERS) {
    marked = marked.replace(pattern, (_whole, inner: string) => `${RUN_START}${STYLE_CODES[style]}${inner}${RUN_END}`);
  }
  const words: { text: string; style: WordStyle }[] = [];
  let style: WordStyle = 'plain';
  for (const token of marked.split(/\s+/)) {
    let text = token;
    if (text.startsWith(RUN_START)) {
      style = CODE_STYLES[text.charAt(1)] ?? 'plain';
      text = text.slice(2);
    }
    const closes = text.endsWith(RUN_END);
    text = text.replaceAll(RUN_START, '').replaceAll(RUN_END, '');
    if (text !== '') words.push({ text, style });
    if (closes) style = 'plain';
  }
  return words;
}

/** `markdown` as prompter blocks, spoken words and cue points. */
export function prepareScript(markdown: string): PreparedScript {
  const blocks: PrompterBlock[] = [];
  const words: string[] = [];
  const cues: number[] = [];
  // A heading or a cue note makes the next words start a block at a cue point.
  let pendingCue = false;
  const startBlock = (kind: PrompterBlock['kind'], parsed: PrompterWord[]): PrompterBlock => {
    const block = { kind, words: parsed, cue: pendingCue };
    if (pendingCue) cues.push(parsed[0].index);
    pendingCue = false;
    blocks.push(block);
    return block;
  };
  for (const paragraph of markdown.replace(/\r\n?/g, '\n').split(/\n\s*\n/)) {
    let current: PrompterBlock | null = null;
    for (const rawLine of paragraph.split('\n')) {
      const heading = HEADING.test(rawLine);
      const hasCueNote = rawLine.replace(CUE_NOTE, '') !== rawLine;
      pendingCue ||= heading || hasCueNote;
      const line = rawLine.replace(HEADING, '').replace(CUE_NOTE, ' ').trim();
      if (line === '') continue;
      const parsed = styledWords(line).map((word) => {
        words.push(word.text);
        return { index: words.length - 1, text: word.text, style: word.style };
      });
      if (heading) {
        startBlock('heading', parsed);
        current = null;
      } else if (current !== null && !pendingCue) {
        current.words.push(...parsed);
      } else {
        current = startBlock('paragraph', parsed);
      }
    }
  }
  return { blocks, words, cues };
}

/** The cue point before or after `wordIndex` (the start or end of the script past the last one). */
export function adjacentCue(cues: number[], wordIndex: number, direction: 'previous' | 'next', lastWord: number): number {
  if (direction === 'next') return cues.find((cue) => cue > wordIndex) ?? lastWord;
  return [...cues].reverse().find((cue) => cue < wordIndex) ?? 0;
}

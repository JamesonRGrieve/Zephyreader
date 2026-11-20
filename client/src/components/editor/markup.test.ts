// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { exportName, plainText, wrapSelection } from './markup';

describe('wrapSelection', () => {
  it('wraps the selected words and keeps them selected inside the markup', () => {
    expect(wrapSelection('Hello world', 6, 11, 'bold')).toEqual({
      text: 'Hello **world**',
      selectionStart: 8,
      selectionEnd: 13,
    });
    expect(wrapSelection('Read this now', 5, 9, 'highlight').text).toBe('Read ==this== now');
  });

  it('puts a selected placeholder in when nothing is selected', () => {
    expect(wrapSelection('Hi ', 3, 3, 'cue')).toEqual({ text: 'Hi [cue note]', selectionStart: 4, selectionEnd: 12 });
    expect(wrapSelection('', 0, 0, 'italic').text).toBe('*italic text*');
  });
});

describe('plainText', () => {
  it('drops headings, cue notes and word styles, and keeps the paragraphs', () => {
    expect(plainText('# Opening\n\nGood evening [smile] everyone.\n\nWe **launch** ==today==, *together*.')).toBe(
      'Opening\n\nGood evening everyone.\n\nWe launch today, together.',
    );
  });

  it('leaves an asterisk that is not emphasis alone', () => {
    expect(plainText('2*3*4 is twenty-four')).toBe('2*3*4 is twenty-four');
  });
});

describe('exportName', () => {
  it('keeps letters, numbers, spaces, underscores and dashes', () => {
    expect(exportName('Launch: keynote / v2!', 'md')).toBe('Launch keynote  v2.md');
    expect(exportName('Café_notes-1', 'txt')).toBe('Café_notes-1.txt');
  });

  it('names a script with nothing usable in its title "script"', () => {
    expect(exportName('???', 'txt')).toBe('script.txt');
  });
});

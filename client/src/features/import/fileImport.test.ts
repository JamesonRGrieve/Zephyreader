// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { ImportError, importFile, MAX_IMPORT_BYTES, pageText, rtfToText, titleOf } from './fileImport';

const item = (str: string, y: number, height = 10) => ({ str, height, transform: [1, 0, 0, 1, 0, y] });

describe('titleOf', () => {
  it('uses the file name without its extension, dashes and underscores as spaces', () => {
    expect(titleOf('launch_keynote-v2.docx')).toBe('launch keynote v2');
    expect(titleOf('notes.final.md')).toBe('notes.final');
    expect(titleOf('.md')).toBe('.md');
    expect(titleOf('___.txt')).toBe('Imported script');
  });
});

describe('rtfToText', () => {
  it('keeps the words and paragraphs, and drops control words, groups and escapes', () => {
    const rtf = String.raw`{\rtf1\ansi{\*\generator Writer;}\b Good evening\b0 , everyone.\par Caf\'e9 \u8212? today \{really\}.\par}`;
    expect(rtfToText(rtf)).toBe('Good evening, everyone.\nCafé — today {really}.');
  });

  it('refuses a file that is not RTF', () => {
    expect(() => rtfToText('Just text')).toThrow(ImportError);
  });
});

describe('pageText', () => {
  it('breaks lines where the text moves down, and paragraphs where it jumps', () => {
    expect(pageText([item('Good', 700), item(' evening', 700), item('everyone.', 688), item('Next part', 640)])).toBe(
      'Good evening\neveryone.\n\nNext part',
    );
  });
});

describe('importFile', () => {
  it('imports text and Markdown as they are, with Windows line endings made plain', async () => {
    const imported = await importFile(new File(['# Opening\r\n\r\nGood evening.\r\n'], 'keynote.md'));
    expect(imported).toEqual({ title: 'keynote', content: '# Opening\n\nGood evening.' });
  });

  it('refuses an unsupported type, an empty file and an oversized one', async () => {
    await expect(importFile(new File(['x'], 'slides.pptx'))).rejects.toThrow('Import a .txt, .md, .docx, .pdf or .rtf file');
    await expect(importFile(new File(['   \n'], 'empty.txt'))).rejects.toThrow('That file has no text to import');
    const huge = new File(['x'], 'huge.txt');
    Object.defineProperty(huge, 'size', { value: MAX_IMPORT_BYTES + 1 });
    await expect(importFile(huge)).rejects.toThrow('That file is too large to import');
  });
});

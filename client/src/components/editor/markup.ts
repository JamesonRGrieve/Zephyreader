// SPDX-License-Identifier: AGPL-3.0-or-later
/** Editing helpers: wrapping a selection in script markup, and exporting a script. */

export const MARKUP = {
  bold: { before: '**', after: '**', placeholder: 'bold text' },
  italic: { before: '*', after: '*', placeholder: 'italic text' },
  highlight: { before: '==', after: '==', placeholder: 'highlighted text' },
  cue: { before: '[', after: ']', placeholder: 'cue note' },
} as const;

export type Markup = keyof typeof MARKUP;

export interface Edit {
  text: string;
  selectionStart: number;
  selectionEnd: number;
}

/** `text` with the selection wrapped in `markup` (a placeholder when nothing is selected). */
export function wrapSelection(text: string, start: number, end: number, markup: Markup): Edit {
  const { before, after, placeholder } = MARKUP[markup];
  const selected = text.slice(start, end) || placeholder;
  const wrapped = `${before}${selected}${after}`;
  return {
    text: `${text.slice(0, start)}${wrapped}${text.slice(end)}`,
    selectionStart: start + before.length,
    selectionEnd: start + before.length + selected.length,
  };
}

/** The script as plain text: markup and cue notes removed, paragraphs kept. */
export function plainText(markdown: string): string {
  return markdown
    .replace(/\[[^\]\n]*\]/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/==([^=]+)==/g, '$1')
    .replace(/(?<![*\w])\*([^*]+)\*(?![*\w])/g, '$1')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/ {2,}/g, ' ')
    .trim();
}

/** The file name an export downloads as. */
export function exportName(title: string, extension: 'md' | 'txt'): string {
  const safe = title.replace(/[^\p{L}\p{N} _-]+/gu, '').trim() || 'script';
  return `${safe}.${extension}`;
}

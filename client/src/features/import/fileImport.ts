// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Importing a file as a script, entirely in the browser (both variants): plain text and
 * Markdown as they are, Word documents through mammoth, PDFs through pdf.js, and RTF by
 * stripping its control words. The heavy libraries load only when such a file is picked.
 */

import type { TextItem } from 'pdfjs-dist/types/src/display/api';

export const IMPORT_ACCEPT = '.txt,.md,.markdown,.docx,.pdf,.rtf,text/plain,text/markdown';
/** The largest file imported (bytes): far beyond any script, small enough to parse in a tab. */
export const MAX_IMPORT_BYTES = 20 * 1024 * 1024;
const PDF_LINE_GAP = 2;

export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportError';
  }
}

export interface ImportedScript {
  title: string;
  content: string;
}

function extension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
}

/** The file name without its extension, as a script title. */
export function titleOf(name: string): string {
  const dot = name.lastIndexOf('.');
  const base = (dot > 0 ? name.slice(0, dot) : name).replace(/[_-]+/g, ' ').trim();
  return base === '' ? 'Imported script' : base;
}

/** RTF as plain text: control words, groups and escapes removed, paragraphs kept. */
export function rtfToText(rtf: string): string {
  if (!rtf.trimStart().startsWith('{\\rtf')) throw new ImportError('This is not an RTF document');
  return (
    rtf
      .replace(/\{\\\*[^{}]*\}/g, '')
      // A control word's delimiting space is part of it, not of the text.
      .replace(/\\pard?\b ?/g, '\n')
      .replace(/\\'([0-9a-fA-F]{2})/g, (_match, hex: string) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/\\u(-?\d+)\??/g, (_match, code: string) =>
        String.fromCharCode(Number(code) < 0 ? Number(code) + 65536 : Number(code)),
      )
      .replace(/\\[a-zA-Z]+-?\d* ?/g, '')
      // Group braces go before escapes are undone, so an escaped \{ or \} stays in the text.
      .replace(/(?<!\\)[{}]/g, '')
      .replace(/\\([{}\\])/g, '$1')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}

async function docxToMarkdown(buffer: ArrayBuffer): Promise<string> {
  const mammoth = await import('mammoth');
  const { value } = await mammoth.extractRawText({ arrayBuffer: buffer });
  return value.replace(/\n{3,}/g, '\n\n').trim();
}

type PdfTextItem = Pick<TextItem, 'str' | 'height' | 'transform'>;

/** One page's text, with a blank line where the text jumps further than a line. */
export function pageText(items: readonly PdfTextItem[]): string {
  let lastY: number | null = null;
  let text = '';
  for (const item of items) {
    const y = item.transform[5];
    if (lastY !== null && Math.abs(y - lastY) > item.height * PDF_LINE_GAP) text += '\n\n';
    else if (lastY !== null && y !== lastY) text += '\n';
    text += item.str;
    lastY = y;
  }
  return text.trim();
}

async function pdfToText(buffer: ArrayBuffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  // The worker is bundled with the app and served from its own origin, never another site.
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  const document = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  const numbers = Array.from({ length: document.numPages }, (_, index) => index + 1);
  const pages = await Promise.all(
    numbers.map(async (number) => {
      const content = await (await document.getPage(number)).getTextContent();
      return pageText(content.items.filter((item): item is TextItem => 'str' in item));
    }),
  );
  return pages
    .join('\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

/** `file` as a script: its title and Markdown text. */
export async function importFile(file: File): Promise<ImportedScript> {
  if (file.size > MAX_IMPORT_BYTES) throw new ImportError('That file is too large to import');
  const kind = extension(file.name);
  let content: string;
  switch (kind) {
    case 'txt':
    case 'md':
    case 'markdown':
      content = (await file.text()).replace(/\r\n?/g, '\n').trim();
      break;
    case 'rtf':
      content = rtfToText(await file.text());
      break;
    case 'docx':
      content = await docxToMarkdown(await file.arrayBuffer());
      break;
    case 'pdf':
      content = await pdfToText(await file.arrayBuffer());
      break;
    default:
      throw new ImportError('Import a .txt, .md, .docx, .pdf or .rtf file');
  }
  if (content === '') throw new ImportError('That file has no text to import');
  return { title: titleOf(file.name), content };
}

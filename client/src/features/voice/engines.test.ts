// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, describe, expect, it, vi } from 'vitest';
import { browserEngineAvailable, createEngine, words } from './engines';

describe('words', () => {
  it('splits heard text into words, whatever the spacing', () => {
    expect(words('  good evening\teveryone \n')).toEqual(['good', 'evening', 'everyone']);
    expect(words('')).toEqual([]);
  });
});

describe('browserEngineAvailable', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is there where the browser has a speech recogniser, prefixed or not', () => {
    vi.stubGlobal('SpeechRecognition', undefined);
    vi.stubGlobal('webkitSpeechRecognition', undefined);
    expect(browserEngineAvailable()).toBe(false);
    vi.stubGlobal('webkitSpeechRecognition', class {});
    expect(browserEngineAvailable()).toBe(true);
  });
});

describe('createEngine', () => {
  it('makes the engine asked for, without starting it', () => {
    const options = { baseUrl: '/api', language: 'en-GB' };
    expect(createEngine('browser', options).name).toBe('browser');
    expect(createEngine('server', options).name).toBe('server');
    // The on-device model loads its worker only when started.
    expect(createEngine('local', options).name).toBe('local');
  });
});

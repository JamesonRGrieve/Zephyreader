// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { actionForKey, asAction, DEFAULT_KEYMAP, gamepadActions } from './actions';

describe('asAction', () => {
  it('accepts only the names of actions (a remote command is untrusted text)', () => {
    expect(asAction('mirror')).toBe('mirror');
    expect(asAction('nextCue')).toBe('nextCue');
    expect(asAction('rm -rf')).toBeNull();
    expect(asAction(3)).toBeNull();
    expect(asAction(undefined)).toBeNull();
  });
});

describe('actionForKey', () => {
  it('maps keys, page-turners and media keys to actions', () => {
    expect(actionForKey(DEFAULT_KEYMAP, ' ', null)).toBe('playPause');
    expect(actionForKey(DEFAULT_KEYMAP, 'PageDown', null)).toBe('scrollForward');
    expect(actionForKey(DEFAULT_KEYMAP, 'PageUp', null)).toBe('scrollBack');
    expect(actionForKey(DEFAULT_KEYMAP, 'MediaTrackNext', null)).toBe('nextCue');
    expect(actionForKey(DEFAULT_KEYMAP, 'x', null)).toBeNull();
  });

  it('leaves keys typed into a text field alone', () => {
    for (const tag of ['input', 'textarea', 'select']) {
      expect(actionForKey(DEFAULT_KEYMAP, ' ', document.createElement(tag))).toBeNull();
    }
    expect(actionForKey(DEFAULT_KEYMAP, ' ', document.createElement('div'))).toBe('playPause');
  });
});

describe('gamepadActions', () => {
  it('acts once per press: a button held down does not repeat', () => {
    expect(gamepadActions([true], [])).toEqual(['playPause']);
    expect(gamepadActions([true], [true])).toEqual([]);
  });

  it('reports every newly pressed button, in the actions’ order', () => {
    const pressed: boolean[] = [];
    pressed[1] = true;
    pressed[12] = true;
    expect(gamepadActions(pressed, [])).toEqual(['faster', 'nextCue']);
  });
});

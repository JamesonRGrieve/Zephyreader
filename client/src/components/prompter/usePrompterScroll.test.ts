// SPDX-License-Identifier: AGPL-3.0-or-later
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PreparedScript } from '~/features/prompter/script';
import { DEFAULT_SETTINGS, type PrompterSettings, SPEED } from '~/features/prompter/settings';
import { usePrompterScroll, wordAt } from './usePrompterScroll';

const WORD_GAP = 100;
const VIEW_HEIGHT = 300;
const WORDS = 10;
// The eye line sits a tenth of the way down: 30 px.
const EYE_LINE = 0.1;

/**
 * A laid-out script as jsdom can't lay one out: ten words 100 px apart in a 300 px window, with a
 * scrollTop that stays where it is put (clamped as a browser clamps it).
 */
function laidOutScript(): HTMLElement {
  const element = document.createElement('div');
  for (let index = 0; index < WORDS; index += 1) {
    const word = document.createElement('span');
    word.dataset.word = String(index);
    Object.defineProperty(word, 'offsetTop', { value: index * WORD_GAP });
    element.append(word);
  }
  const scrollHeight = WORDS * WORD_GAP;
  let top = 0;
  Object.defineProperties(element, {
    scrollHeight: { value: scrollHeight },
    clientHeight: { value: VIEW_HEIGHT },
    scrollTop: {
      get: () => top,
      set: (value: number) => {
        top = Math.max(0, Math.min(value, scrollHeight - VIEW_HEIGHT));
      },
    },
  });
  return element;
}

const SCRIPT: PreparedScript = {
  blocks: [],
  words: Array.from({ length: WORDS }, (_, index) => `word${index}`),
  cues: [0, 4, 8],
};

function prompter(overrides: Partial<PrompterSettings> = {}, isMain = true) {
  const element = laidOutScript();
  // One ref and one settings object for the hook's life, as a component holds them: a new ref each
  // render would re-run the hook's effects on every render, without end.
  const ref = { current: element };
  const settings = { ...DEFAULT_SETTINGS, eyeLinePosition: EYE_LINE, ...overrides };
  const hook = renderHook(() => usePrompterScroll(ref, SCRIPT, settings, isMain));
  return { element, hook };
}

describe('wordAt', () => {
  it('finds the last word whose top is at or above a line, and the first word above them all', () => {
    const offsets = [0, 100, 200, 300];
    expect(wordAt([], 50)).toBeNull();
    expect(wordAt(offsets, 0)).toBe(0);
    expect(wordAt(offsets, 250)).toBe(2);
    expect(wordAt(offsets, 999)).toBe(3);
    expect(wordAt([40, 80], 10)).toBe(0);
  });
});

describe('usePrompterScroll', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('counts down before it starts, and Start again during the countdown cancels it', () => {
    const { hook } = prompter({ countdownSeconds: 3, scrollMode: 'manual' });
    act(() => hook.result.current.toggle());
    expect(hook.result.current.countdown).toBe(3);
    // One second at a time: each tick's timer is set once the last one has rendered.
    act(() => void vi.advanceTimersByTime(1000));
    expect(hook.result.current.countdown).toBe(2);
    act(() => void vi.advanceTimersByTime(1000));
    expect(hook.result.current.countdown).toBe(1);
    act(() => void vi.advanceTimersByTime(1000));
    expect(hook.result.current.countdown).toBeNull();
    expect(hook.result.current.playing).toBe(true);

    act(() => hook.result.current.stop());
    act(() => hook.result.current.toggle());
    act(() => hook.result.current.toggle());
    expect(hook.result.current.countdown).toBeNull();
    expect(hook.result.current.playing).toBe(false);
  });

  it('starts at once with no countdown', () => {
    const { hook } = prompter({ countdownSeconds: 0, scrollMode: 'manual' });
    act(() => hook.result.current.toggle());
    expect(hook.result.current.playing).toBe(true);
  });

  it('keeps a speed change within the allowed range, until the setting itself changes', () => {
    const { hook } = prompter({ speed: 150 });
    act(() => hook.result.current.setSpeed(10_000));
    expect(hook.result.current.speed).toBe(SPEED.max);
    act(() => hook.result.current.setSpeed(1));
    expect(hook.result.current.speed).toBe(SPEED.min);
  });

  it('nudges a quarter of the window, jumps between cues, and goes back to the start', () => {
    const { element, hook } = prompter();
    act(() => hook.result.current.nudge(1));
    expect(element.scrollTop).toBe(VIEW_HEIGHT / 4);

    // The next cue after the word on the eye line is word 4: its top goes to the eye line.
    act(() => hook.result.current.jumpCue('next'));
    expect(element.scrollTop).toBe(4 * WORD_GAP - VIEW_HEIGHT * EYE_LINE);
    expect(hook.result.current.readingWord).toBe(4);

    act(() => hook.result.current.toStart());
    expect(element.scrollTop).toBe(0);
    expect(hook.result.current.elapsed).toBe(0);
  });

  it('shows a follower where the leader is, and reports how far through it is', () => {
    const { element, hook } = prompter({}, false);
    act(() => hook.result.current.followTo(0.5));
    expect(element.scrollTop).toBe(0.5 * (WORDS * WORD_GAP - VIEW_HEIGHT));
    expect(hook.result.current.ratio()).toBeCloseTo(0.5);
  });
});

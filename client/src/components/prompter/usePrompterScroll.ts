'use client';
// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The prompter's scrolling: one animation loop moving the script element in the chosen
 * mode (constant speed, fitted to a target time, or following the voice), the countdown
 * before it starts, and what the presenter is shown about it (the word on the eye line,
 * progress, time left, pace). A follower display runs none of it and mirrors the main
 * display's position instead (`followTo`).
 */
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { adjacentCue, type PreparedScript } from '~/features/prompter/script';
import { SPEED, type PrompterSettings } from '~/features/prompter/settings';
import { progress, secondsLeft, timedSpeed, wordsPerMinute } from '~/features/prompter/timing';

/** How much of the remaining gap a voice-follow scroll closes each second (smooth catch-up). */
const VOICE_CATCH_UP_PER_SECOND = 4;
/** Nudges move this share of the visible height. */
const NUDGE_SHARE = 0.25;
const MS_PER_SECOND = 1000;
/** Speed changes from a key or remote step by this much. */
export const SPEED_STEP = 10;

export interface PrompterScroll {
  playing: boolean;
  /** Seconds left before scrolling starts, while counting down. */
  countdown: number | null;
  elapsed: number;
  readingWord: number | null;
  progress: number;
  secondsLeft: number | null;
  wordsPerMinute: number | null;
  speed: number;
  toggle: () => void;
  stop: () => void;
  setSpeed: (speed: number) => void;
  nudge: (direction: 1 | -1) => void;
  jumpCue: (direction: 'previous' | 'next') => void;
  toStart: () => void;
  /** Voice-follow: the speaker has reached `wordIndex`. */
  voiceAt: (wordIndex: number) => void;
  /** Follower displays: show the main display's position. */
  followTo: (ratio: number) => void;
  /** The scrolled share of the script, for followers. */
  ratio: () => number;
  /** Re-measures after the reader scrolled by hand. */
  measure: () => void;
}

/**
 * Word offsets from the top of the scrolling content, by word index. `offsetTop` ignores
 * CSS transforms, so a mirrored prompter measures the same as an unmirrored one; the
 * scrolling element is the words' offset parent (it is positioned).
 */
function measureWords(container: HTMLElement): number[] {
  const offsets: number[] = [];
  for (const element of container.querySelectorAll<HTMLElement>('[data-word]')) {
    offsets[Number(element.dataset.word)] = element.offsetTop;
  }
  return offsets;
}

/** The last word whose top is at or above `y` (binary search over ascending offsets). */
export function wordAt(offsets: readonly number[], y: number): number | null {
  if (offsets.length === 0) return null;
  let low = 0;
  let high = offsets.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (offsets[middle] <= y) low = middle;
    else high = middle - 1;
  }
  return offsets[low] <= y ? low : 0;
}

export function usePrompterScroll(
  containerRef: RefObject<HTMLDivElement | null>,
  script: PreparedScript,
  settings: PrompterSettings,
  isMain: boolean,
): PrompterScroll {
  const [playing, setPlaying] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [readingWord, setReadingWord] = useState<number | null>(null);
  // A speed the presenter changed while prompting, until their setting changes.
  const [speedChange, setSpeedChange] = useState<{ from: number; to: number } | null>(null);
  const speed = speedChange !== null && speedChange.from === settings.speed ? speedChange.to : settings.speed;
  const [view, setView] = useState({ progress: 0, remaining: 0 });
  const offsets = useRef<number[]>([]);
  const position = useRef(0);
  const voiceTarget = useRef<number | null>(null);
  const elapsedRef = useRef(0);

  const eyeLineY = useCallback(
    (element: HTMLElement) => element.clientHeight * settings.eyeLinePosition,
    [settings.eyeLinePosition],
  );

  const refresh = useCallback(() => {
    const element = containerRef.current;
    if (element === null) return;
    const scrollable = element.scrollHeight - element.clientHeight;
    const lastOffset = offsets.current.at(-1) ?? scrollable;
    setReadingWord(wordAt(offsets.current, element.scrollTop + eyeLineY(element) + 1));
    setView({
      progress: progress(element.scrollTop, Math.max(1, lastOffset - eyeLineY(element))),
      remaining: Math.max(0, lastOffset - eyeLineY(element) - element.scrollTop),
    });
  }, [containerRef, eyeLineY]);

  const measure = useCallback(() => {
    const element = containerRef.current;
    if (element === null) return;
    offsets.current = measureWords(element);
    position.current = element.scrollTop;
    refresh();
  }, [containerRef, refresh]);

  // Re-measure whenever the words or their layout change.
  useEffect(() => {
    const element = containerRef.current;
    if (element === null) return undefined;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [
    containerRef,
    measure,
    script,
    settings.fontSize,
    settings.fontFamily,
    settings.lineHeight,
    settings.marginPercent,
    settings.allCaps,
  ]);

  const scrollTo = useCallback(
    (top: number) => {
      const element = containerRef.current;
      if (element === null) return;
      position.current = Math.max(0, Math.min(top, element.scrollHeight - element.clientHeight));
      element.scrollTop = position.current;
      refresh();
    },
    [containerRef, refresh],
  );

  const scrollToWord = useCallback(
    (index: number) => {
      const element = containerRef.current;
      const offset = offsets.current[index];
      if (element === null || offset === undefined) return;
      voiceTarget.current = null;
      scrollTo(offset - eyeLineY(element));
    },
    [containerRef, scrollTo, eyeLineY],
  );

  // The countdown, then playing.
  useEffect(() => {
    if (countdown === null) return undefined;
    const timer = setTimeout(() => {
      if (countdown <= 1) {
        setCountdown(null);
        setPlaying(true);
      } else {
        setCountdown(countdown - 1);
      }
    }, MS_PER_SECOND);
    return () => clearTimeout(timer);
  }, [countdown]);

  // The animation loop: only on the main display, only while playing.
  useEffect(() => {
    if (!playing || !isMain) return undefined;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number): void => {
      const element = containerRef.current;
      const dt = (now - last) / MS_PER_SECOND;
      last = now;
      if (element !== null && dt > 0) {
        elapsedRef.current += dt;
        const end = element.scrollHeight - element.clientHeight;
        if (settings.scrollMode === 'constant' || settings.scrollMode === 'timed') {
          const lastOffset = offsets.current.at(-1) ?? end;
          const remaining = Math.max(0, lastOffset - eyeLineY(element) - position.current);
          const pace =
            settings.scrollMode === 'timed'
              ? timedSpeed(remaining, settings.targetDurationSeconds - elapsedRef.current)
              : speed;
          position.current = Math.min(end, position.current + pace * dt);
          element.scrollTop = position.current;
          if (remaining <= 0 || position.current >= end) setPlaying(false);
        } else if (settings.scrollMode === 'voice' && voiceTarget.current !== null) {
          const gap = voiceTarget.current - position.current;
          position.current += gap * Math.min(1, VOICE_CATCH_UP_PER_SECOND * dt);
          element.scrollTop = position.current;
        }
        refresh();
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const clock = setInterval(() => setElapsed(elapsedRef.current), MS_PER_SECOND / 4);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(clock);
      setElapsed(elapsedRef.current);
    };
  }, [playing, isMain, containerRef, settings.scrollMode, settings.targetDurationSeconds, speed, refresh, eyeLineY]);

  const toggle = useCallback(() => {
    if (playing || countdown !== null) {
      setPlaying(false);
      setCountdown(null);
      return;
    }
    measure();
    if (settings.countdownSeconds > 0) setCountdown(settings.countdownSeconds);
    else setPlaying(true);
  }, [playing, countdown, measure, settings.countdownSeconds]);

  const wordsRead = readingWord ?? 0;
  return {
    playing,
    countdown,
    elapsed,
    readingWord,
    progress: view.progress,
    secondsLeft:
      settings.scrollMode === 'timed'
        ? Math.max(0, settings.targetDurationSeconds - elapsed)
        : settings.scrollMode === 'constant'
          ? secondsLeft(view.remaining, speed)
          : null,
    wordsPerMinute: wordsPerMinute(wordsRead, elapsed),
    speed,
    toggle,
    stop: () => {
      setPlaying(false);
      setCountdown(null);
    },
    setSpeed: (next) => setSpeedChange({ from: settings.speed, to: Math.min(SPEED.max, Math.max(SPEED.min, next)) }),
    nudge: (direction) => {
      const element = containerRef.current;
      if (element !== null) scrollTo(position.current + direction * element.clientHeight * NUDGE_SHARE);
    },
    jumpCue: (direction) => scrollToWord(adjacentCue(script.cues, readingWord ?? 0, direction, script.words.length - 1)),
    toStart: () => {
      scrollTo(0);
      elapsedRef.current = 0;
      setElapsed(0);
    },
    voiceAt: (wordIndex) => {
      const element = containerRef.current;
      const next = offsets.current[Math.min(wordIndex + 1, offsets.current.length - 1)];
      if (element !== null && next !== undefined) voiceTarget.current = next - eyeLineY(element);
    },
    followTo: (ratio) => {
      const element = containerRef.current;
      if (element !== null) scrollTo(ratio * (element.scrollHeight - element.clientHeight));
    },
    ratio: () => {
      const element = containerRef.current;
      if (element === null) return 0;
      return progress(element.scrollTop, element.scrollHeight - element.clientHeight);
    },
    measure,
  };
}

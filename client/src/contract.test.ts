// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import wordCountCases from '../../contract/word-count-cases.json';
import { AI_ACTION_LABELS } from '~/components/editor/AiPanel';
import { AI_ACTIONS, CLIP_MEDIA_TYPES, RECORDING_MEDIA_TYPES } from '~/contract';
import { spokenWordCount } from '~/features/prompter/script';
import { VIDEO_TYPES } from '~/features/recording/recorder';
import { CLIP_TYPES } from '~/features/voice/clipRecorder';

/** A media type without its parameters (`video/webm;codecs=vp9` → `video/webm`). */
const baseType = (type: string) => type.split(';')[0];

describe('the shared contract (contract/teleprompter.json)', () => {
  it('counts words exactly as the server does, case by case (contract/word-count-cases.json)', () => {
    for (const { text, words } of wordCountCases.cases) {
      expect(spokenWordCount(text), JSON.stringify(text)).toBe(words);
    }
  });

  it('names every action the AI writer takes', () => {
    for (const action of AI_ACTIONS) expect(AI_ACTION_LABELS[action], action).toBeTruthy();
  });

  it('records takes and voice clips only in types the server accepts', () => {
    for (const type of VIDEO_TYPES) expect(RECORDING_MEDIA_TYPES, type).toContain(baseType(type));
    for (const type of CLIP_TYPES) expect(CLIP_MEDIA_TYPES, type).toContain(baseType(type));
  });
});

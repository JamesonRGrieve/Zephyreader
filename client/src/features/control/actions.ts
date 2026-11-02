// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * What the presenter can do while prompting, and which keys, media keys and game
 * controller buttons do it. Bluetooth page-turners and foot pedals send ordinary keys
 * (PageDown/PageUp, the arrows, Space or media keys), so the same keymap drives them.
 */

export const PROMPTER_ACTIONS = [
  'playPause',
  'faster',
  'slower',
  'scrollBack',
  'scrollForward',
  'previousCue',
  'nextCue',
  'toStart',
  'mirror',
  'fullscreen',
] as const;

export type PrompterAction = (typeof PROMPTER_ACTIONS)[number];

export const ACTION_LABELS: Record<PrompterAction, string> = {
  playPause: 'Play / pause',
  faster: 'Faster',
  slower: 'Slower',
  scrollBack: 'Scroll back',
  scrollForward: 'Scroll forward',
  previousCue: 'Previous cue',
  nextCue: 'Next cue',
  toStart: 'Back to the start',
  mirror: 'Mirror',
  fullscreen: 'Full screen',
};

export type Keymap = Record<PrompterAction, readonly string[]>;

/** `KeyboardEvent.key` values per action; page-turners send the PageUp/PageDown pair. */
export const DEFAULT_KEYMAP: Keymap = {
  playPause: [' ', 'Enter', 'MediaPlayPause'],
  faster: ['ArrowUp', '+', '='],
  slower: ['ArrowDown', '-', '_'],
  scrollBack: ['ArrowLeft', 'PageUp'],
  scrollForward: ['ArrowRight', 'PageDown'],
  previousCue: ['[', 'MediaTrackPrevious'],
  nextCue: [']', 'MediaTrackNext'],
  toStart: ['Home'],
  mirror: ['m', 'M'],
  fullscreen: ['f', 'F'],
};

/** Standard-mapping gamepad buttons per action (https://w3c.github.io/gamepad/#remapping). */
export const DEFAULT_GAMEPAD: Partial<Record<PrompterAction, readonly number[]>> = {
  playPause: [0, 9],
  faster: [12],
  slower: [13],
  scrollBack: [14, 4],
  scrollForward: [15, 5],
  previousCue: [2],
  nextCue: [1],
  toStart: [8],
};

/** Media Session actions (headset and keyboard media buttons) per prompter action. */
export const MEDIA_SESSION_ACTIONS: Partial<Record<PrompterAction, MediaSessionAction>> = {
  previousCue: 'previoustrack',
  nextCue: 'nexttrack',
};

/** `value` as an action, when it names one (a remote's command arrives as untrusted text). */
export function asAction(value: unknown): PrompterAction | null {
  return PROMPTER_ACTIONS.find((action) => action === value) ?? null;
}

/** The action a key press asks for, ignoring presses meant for a text field. */
export function actionForKey(keymap: Keymap, key: string, target: EventTarget | null): PrompterAction | null {
  if (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  ) {
    return null;
  }
  return PROMPTER_ACTIONS.find((action) => keymap[action].includes(key)) ?? null;
}

/** The actions newly pressed on a gamepad: buttons down now that were not before. */
export function gamepadActions(pressed: readonly boolean[], previously: readonly boolean[]): PrompterAction[] {
  const actions: PrompterAction[] = [];
  for (const action of PROMPTER_ACTIONS) {
    const buttons = DEFAULT_GAMEPAD[action] ?? [];
    if (buttons.some((button) => pressed[button] === true && previously[button] !== true)) actions.push(action);
  }
  return actions;
}

// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * How the prompter looks and scrolls. Saved per user as the `settings` of their
 * prompter_preference record (both variants), so every device opens the same way.
 * A stored object is read leniently: unknown keys are dropped and anything missing
 * or invalid falls back to its default, so older or hand-edited settings still load.
 */
import { z } from 'zod';

export const FONT_SIZE = { min: 24, max: 200, step: 2, default: 56 } as const;
export const LINE_HEIGHT = { min: 1, max: 2.5, step: 0.05, default: 1.5 } as const;
export const MARGIN_PERCENT = { min: 0, max: 30, step: 1, default: 10 } as const;
export const SPEED = { min: 10, max: 400, step: 5, default: 60 } as const;
export const COUNTDOWN_SECONDS = { min: 0, max: 10, step: 1, default: 3 } as const;
export const EYE_LINE = { min: 0.1, max: 0.6, step: 0.01, default: 0.33 } as const;
export const TARGET_DURATION_SECONDS = { min: 10, max: 4 * 60 * 60, default: 5 * 60 } as const;
export const READING_WPM = { min: 60, max: 260, default: 150 } as const;

export const FONT_FAMILIES = ['sans', 'serif', 'mono', 'rounded'] as const;
export const ALIGNMENTS = ['left', 'center'] as const;
export const THEMES = ['dark', 'light', 'high-contrast', 'custom'] as const;
export const SCROLL_MODES = ['manual', 'constant', 'timed', 'voice'] as const;
export const VOICE_ENGINES = ['local', 'browser', 'server'] as const;

export type FontFamily = (typeof FONT_FAMILIES)[number];
export type ScrollMode = (typeof SCROLL_MODES)[number];
export type VoiceEngineName = (typeof VOICE_ENGINES)[number];
export type Theme = (typeof THEMES)[number];

/** System font stacks only: the prompter never loads a font from another site. */
export const FONT_STACKS: Record<FontFamily, string> = {
  sans: 'ui-sans-serif, system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  serif: 'ui-serif, Georgia, Cambria, "Times New Roman", serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  rounded: 'ui-rounded, "SF Pro Rounded", "Nunito", system-ui, sans-serif',
};

/** Text and background per theme; `custom` uses the settings' own colours. */
export const THEME_COLOURS: Record<Exclude<Theme, 'custom'>, { text: string; background: string }> = {
  dark: { text: '#f5f5f5', background: '#000000' },
  light: { text: '#111111', background: '#ffffff' },
  'high-contrast': { text: '#ffe600', background: '#000000' },
};

const HEX_COLOUR = /^#[0-9a-fA-F]{6}$/;

function bounded(range: { min: number; max: number; default: number }) {
  return z.number().min(range.min).max(range.max).catch(range.default);
}

export const prompterSettingsSchema = z.object({
  fontSize: bounded(FONT_SIZE),
  fontFamily: z.enum(FONT_FAMILIES).catch('sans'),
  lineHeight: bounded(LINE_HEIGHT),
  marginPercent: bounded(MARGIN_PERCENT),
  align: z.enum(ALIGNMENTS).catch('left'),
  allCaps: z.boolean().catch(false),
  theme: z.enum(THEMES).catch('dark'),
  textColour: z.string().regex(HEX_COLOUR).catch('#f5f5f5'),
  backgroundColour: z.string().regex(HEX_COLOUR).catch('#000000'),
  mirrorHorizontal: z.boolean().catch(false),
  mirrorVertical: z.boolean().catch(false),
  eyeLine: z.boolean().catch(true),
  eyeLinePosition: bounded(EYE_LINE),
  highlightReadingLine: z.boolean().catch(true),
  countdownSeconds: bounded(COUNTDOWN_SECONDS),
  scrollMode: z.enum(SCROLL_MODES).catch('constant'),
  speed: bounded(SPEED),
  targetDurationSeconds: bounded(TARGET_DURATION_SECONDS),
  readingWpm: bounded(READING_WPM),
  voiceEngine: z.enum(VOICE_ENGINES).catch('local'),
  language: z.string().min(2).max(16).catch('en'),
});

export type PrompterSettings = z.infer<typeof prompterSettingsSchema>;

export const DEFAULT_SETTINGS: PrompterSettings = prompterSettingsSchema.parse({});

/** A stored settings object as usable settings: defaults for anything missing or invalid. */
export function readSettings(stored: unknown): PrompterSettings {
  const object = typeof stored === 'object' && stored !== null && !Array.isArray(stored) ? stored : {};
  return prompterSettingsSchema.parse(object);
}

/** The colours the prompter is drawn in. */
export function colours(settings: PrompterSettings): { text: string; background: string } {
  return settings.theme === 'custom'
    ? { text: settings.textColour, background: settings.backgroundColour }
    : THEME_COLOURS[settings.theme];
}

/** The CSS transform that mirrors the prompter for a beam-splitter rig. */
export function mirrorTransform(settings: PrompterSettings): string {
  return `scale(${settings.mirrorHorizontal ? -1 : 1}, ${settings.mirrorVertical ? -1 : 1})`;
}

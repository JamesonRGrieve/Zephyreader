// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Zephyreader's shared knowledge, from the one file the SaaS server reads too
 * (contract/teleprompter.json at the repository root): record limits, the paid feature
 * ids, the AI writer's actions and the media types takes and voice clips may be. The UI
 * and the lite API use these, never copies of their values.
 */
import contract from '../../contract/teleprompter.json';

export const LIMITS = contract.limits;
export const PAID_FEATURE_IDS = contract.paid_features;
export const AI_ACTIONS: readonly string[] = contract.ai_actions;
export const RECORDING_MEDIA_TYPES: readonly string[] = contract.recording_media_types;
export const CLIP_MEDIA_TYPES: readonly string[] = contract.clip_media_types;

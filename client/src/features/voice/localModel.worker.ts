// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The on-device speech engine's worker: a Whisper model (transformers.js) transcribing
 * 16 kHz clips off the page's thread. The model is served by this app (`/models/`) and
 * never fetched from another site; `scripts/fetch-voice-model.mjs` installs it.
 */
import { env, pipeline, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers';

/** The model, under public/models/ (an ONNX export of Whisper tiny, English). */
export const LOCAL_VOICE_MODEL = 'onnx-community/whisper-tiny.en';

export type WorkerRequest = { kind: 'load' } | { kind: 'transcribe'; id: number; audio: Float32Array };
export type WorkerReply =
  { kind: 'ready' } | { kind: 'text'; id: number; text: string } | { kind: 'error'; message: string };

env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = '/models/';

let recogniser: Promise<AutomaticSpeechRecognitionPipeline> | null = null;

function reply(message: WorkerReply): void {
  self.postMessage(message);
}

function load(): Promise<AutomaticSpeechRecognitionPipeline> {
  recogniser ??= pipeline('automatic-speech-recognition', LOCAL_VOICE_MODEL, { dtype: 'q8' });
  return recogniser;
}

self.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  void (async () => {
    try {
      const transcribe = await load();
      if (request.kind === 'load') {
        reply({ kind: 'ready' });
        return;
      }
      const output = await transcribe(request.audio);
      const text = Array.isArray(output) ? output.map((part) => part.text).join(' ') : output.text;
      reply({ kind: 'text', id: request.id, text });
    } catch (error) {
      recogniser = null;
      reply({ kind: 'error', message: error instanceof Error ? error.message : 'The voice model failed' });
    }
  })();
});

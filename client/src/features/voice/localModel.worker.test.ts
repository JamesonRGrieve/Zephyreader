// SPDX-License-Identifier: AGPL-3.0-or-later
import { beforeAll, describe, expect, it, vi } from 'vitest';

/** transformers.js stood in for: its settings object, and a pipeline that yields one recogniser. */
const model = vi.hoisted(() => {
  const recogniser = vi.fn();
  return { env: {} as Record<string, unknown>, recogniser, pipeline: vi.fn(async () => recogniser) };
});
vi.mock('@huggingface/transformers', () => ({ env: model.env, pipeline: model.pipeline }));

const replies: unknown[] = [];

/** Posts `data` to the worker and waits for its reply. */
async function ask(data: unknown): Promise<unknown> {
  const before = replies.length;
  self.dispatchEvent(new MessageEvent('message', { data }));
  await vi.waitFor(() => expect(replies.length).toBeGreaterThan(before));
  return replies.at(-1);
}

describe('the on-device voice worker', () => {
  beforeAll(async () => {
    vi.spyOn(self, 'postMessage').mockImplementation((message: unknown) => void replies.push(message));
    await import('./localModel.worker');
  });

  it('loads the model from this app only, never from another site', async () => {
    expect(model.env).toMatchObject({ allowRemoteModels: false, allowLocalModels: true, localModelPath: '/models/' });
    expect(await ask({ kind: 'load' })).toEqual({ kind: 'ready' });
    expect(model.pipeline).toHaveBeenCalledWith('automatic-speech-recognition', 'onnx-community/whisper-tiny.en', {
      dtype: 'q8',
    });
  });

  // The test setup clears call counts between tests, so each test counts the loads it causes.
  it('transcribes a clip with the model it loaded once, joining a chunked answer', async () => {
    const loads = model.pipeline.mock.calls.length;
    model.recogniser.mockResolvedValueOnce({ text: 'good evening' });
    expect(await ask({ kind: 'transcribe', id: 7, audio: new Float32Array(16) })).toEqual({
      kind: 'text',
      id: 7,
      text: 'good evening',
    });
    model.recogniser.mockResolvedValueOnce([{ text: 'thank you' }, { text: 'for coming' }]);
    expect(await ask({ kind: 'transcribe', id: 8, audio: new Float32Array(16) })).toEqual({
      kind: 'text',
      id: 8,
      text: 'thank you for coming',
    });
    expect(model.pipeline.mock.calls.length).toBe(loads);
  });

  it('says when the model fails, and loads it again for the next clip', async () => {
    const loads = model.pipeline.mock.calls.length;
    model.recogniser.mockRejectedValueOnce(new Error('out of memory'));
    expect(await ask({ kind: 'transcribe', id: 9, audio: new Float32Array(16) })).toEqual({
      kind: 'error',
      message: 'out of memory',
    });
    model.recogniser.mockResolvedValueOnce({ text: 'welcome' });
    expect(await ask({ kind: 'transcribe', id: 10, audio: new Float32Array(16) })).toEqual({
      kind: 'text',
      id: 10,
      text: 'welcome',
    });
    expect(model.pipeline.mock.calls.length).toBe(loads + 1);
  });
});

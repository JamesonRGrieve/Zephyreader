// SPDX-License-Identifier: AGPL-3.0-or-later
// Installs the on-device voice-follow model (Whisper tiny, English, ONNX, 8-bit) into
// public/models/, where the app serves it from its own origin: browsers never fetch it
// from another site. Run once per deployment (pnpm fetch:voice-model); the files are
// not committed. The model is MIT-licensed (openai/whisper); this ONNX export is
// onnx-community/whisper-tiny.en.
import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const MODEL = 'onnx-community/whisper-tiny.en';
const REVISION = 'main';
const FILES = [
  'config.json',
  'generation_config.json',
  'preprocessor_config.json',
  'tokenizer.json',
  'tokenizer_config.json',
  'onnx/encoder_model_quantized.onnx',
  'onnx/decoder_model_merged_quantized.onnx',
];
const TIMEOUT_MS = 5 * 60 * 1000;
const target = path.join(import.meta.dirname, '..', 'public', 'models', MODEL);

for (const file of FILES) {
  const destination = path.join(target, file);
  const present = await stat(destination).then(
    () => true,
    () => false,
  );
  if (present) {
    console.log(`have ${file}`);
    continue;
  }
  const url = `https://huggingface.co/${MODEL}/resolve/${REVISION}/${file}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, Buffer.from(await response.arrayBuffer()));
  console.log(`fetched ${file}`);
}
console.log(`The voice model is in ${target}`);

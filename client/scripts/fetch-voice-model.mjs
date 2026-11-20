// SPDX-License-Identifier: AGPL-3.0-or-later
// Installs the on-device voice-follow model (Whisper tiny, English, ONNX, 8-bit) into
// public/models/, where the app serves it from its own origin: browsers never fetch it
// from another site. Run once per deployment (pnpm fetch:voice-model); the files are
// not committed. The model is MIT-licensed (openai/whisper); this ONNX export is
// onnx-community/whisper-tiny.en.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const MODEL = 'onnx-community/whisper-tiny.en';
// One commit of the model repository, and each file's SHA-256 at that commit: a file that
// doesn't match is refused, so a deployment serves exactly the model that was reviewed.
const REVISION = '794207fec2761281fe63a23a94b7e9f53a4efbc1';
const FILES = {
  'config.json': '251ea843b5901a99efa58c0b99b8052c6019aa3e7d2baf46693a1128ff606233',
  'generation_config.json': '7b2e8451ed5f118e75fdd991409d72119d21d2fef1eba9723f68fb9c57fe5dc9',
  'preprocessor_config.json': 'a6a76d28c93edb273669eb9e0b0636a2bddbb1272c3261e47b7ca6dfdbac1b8d',
  'tokenizer.json': '5eb60cec1e77aeeb6869a2bb5a8e01a84c3fe5d072d75369343021fe6f5310d0',
  'tokenizer_config.json': '93879c3dccdd4b976f709acd85b44778873f30c275e67026f30ca1e4c975230c',
  'onnx/encoder_model_quantized.onnx': 'e93ec822f16a8fd264e7de972ad17d615ea7334b75a52d54c50c2e18dd503a25',
  'onnx/decoder_model_merged_quantized.onnx': 'c0592d0749413c960569e1c7fb806b060d5d18f3ebad4a95cbf9a77dc6e9be52',
};
const TIMEOUT_MS = 5 * 60 * 1000;
const target = path.join(import.meta.dirname, '..', 'public', 'models', MODEL);

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

for (const [file, digest] of Object.entries(FILES)) {
  const destination = path.join(target, file);
  const present = await readFile(destination).catch(() => null);
  if (present !== null) {
    if (sha256(present) !== digest) throw new Error(`${destination} is not the pinned file: delete it and run again`);
    console.log(`have ${file}`);
    continue;
  }
  const url = `https://huggingface.co/${MODEL}/resolve/${REVISION}/${file}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (sha256(bytes) !== digest) throw new Error(`${url}: SHA-256 does not match the pinned file`);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, bytes);
  console.log(`fetched ${file}`);
}
console.log(`The voice model is in ${target}`);

import { copyFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const WASM_DIR = join(process.cwd(), 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const WASM_FILES = [
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_nosimd_internal.wasm',
];

async function main() {
  const targetDir = process.argv[2] ?? join(process.cwd(), 'public', 'mediapipe', 'wasm');

  try {
    await mkdir(targetDir, { recursive: true });

    for (const name of WASM_FILES) {
      await copyFile(join(WASM_DIR, name), join(targetDir, name));
    }

    console.log('Copied 4 MediaPipe wasm files.');
  } catch (err) {
    console.error('Failed to copy MediaPipe wasm files:', err);
    process.exitCode = 1;
  }
}

main();

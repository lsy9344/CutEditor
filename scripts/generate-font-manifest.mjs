import { readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const FONT_DIR = join(process.cwd(), 'public', 'font');
const MANIFEST_PATH = join(FONT_DIR, 'fonts.json');

async function main() {
  try {
    const entries = await readdir(FONT_DIR, { withFileTypes: true });
    const ttfFiles = entries
      .filter((e) => e.isFile() && /\.ttf$/i.test(e.name))
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b));

    await writeFile(MANIFEST_PATH, JSON.stringify(ttfFiles, null, 2) + '\n', 'utf8');
    console.log(`Generated fonts.json with ${ttfFiles.length} entries.`);
  } catch (err) {
    console.error('Failed to generate fonts.json:', err);
    process.exitCode = 1;
  }
}

main();


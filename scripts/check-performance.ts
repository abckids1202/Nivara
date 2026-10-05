import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = join(process.cwd(), '.next', 'static', 'chunks');
const maxChunkBytes = 256 * 1024;
const maxTotalBytes = 1.5 * 1024 * 1024;

function collectJavaScript(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectJavaScript(path);
    return entry.name.endsWith('.js') ? [path] : [];
  });
}

let files: string[];
try {
  files = collectJavaScript(root);
} catch {
  console.error('Performance budget failed: run `npm run build` first.');
  process.exit(1);
}

const sizes = files.map((path) => ({ path, bytes: statSync(path).size }));
if (!sizes.length) {
  console.error('Performance budget failed: no JavaScript chunks were produced.');
  process.exit(1);
}
const totalBytes = sizes.reduce((sum, file) => sum + file.bytes, 0);
const largest = [...sizes].sort((a, b) => b.bytes - a.bytes)[0];
const oversized = sizes.filter((file) => file.bytes > maxChunkBytes);

console.log(
  `JavaScript budget: ${files.length} chunks, ${totalBytes} bytes total; largest ${largest?.bytes ?? 0} bytes.`,
);

if (oversized.length || totalBytes > maxTotalBytes) {
  if (oversized.length)
    console.error(
      `Chunks over ${maxChunkBytes} bytes: ${oversized
        .map((file) => `${file.path} (${file.bytes})`)
        .join(', ')}`,
    );
  if (totalBytes > maxTotalBytes)
    console.error(`Total JavaScript exceeds ${maxTotalBytes} bytes.`);
  process.exit(1);
}

console.log('Performance budget passed.');

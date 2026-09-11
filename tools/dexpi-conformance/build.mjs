/**
 * Bundles the conformance CLI (src/cli.ts) into a single Node ESM file.
 *
 * Uses the same `{ '.xml': 'text' }` loader as the extension's esbuild config so
 * that `import xml from './vendor/foo.xml'` inside the editor sources behaves
 * identically here. Output goes to the (gitignored) test-output/.bin/ dir.
 */
import * as esbuild from 'esbuild';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const outfile = path.join(here, 'test-output', '.bin', 'cli.mjs');
fs.mkdirSync(path.dirname(outfile), { recursive: true });

await esbuild.build({
  entryPoints: [path.join(here, 'src', 'cli.ts')],
  bundle: true,
  outfile,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  sourcemap: true,
  loader: { '.xml': 'text', '.dexpi': 'text' },
  // Keep native / heavy deps external — resolved from node_modules at runtime.
  external: ['playwright', 'pixelmatch', 'pngjs'],
  logLevel: 'info',
  banner: {
    js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);",
  },
});

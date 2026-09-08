import { defineConfig } from 'vitest/config';
import * as fs from 'node:fs';

/** Load `*.xml` imports as raw strings, matching the esbuild `text` loader. */
const xmlRawPlugin = {
  name: 'xml-raw',
  enforce: 'pre' as const,
  load(id: string) {
    const path = id.split('?')[0];
    if (path.endsWith('.xml') || path.endsWith('.dexpi')) {
      const src = fs.readFileSync(path, 'utf-8');
      return `export default ${JSON.stringify(src)};`;
    }
    return null;
  },
};

export default defineConfig({
  plugins: [xmlRawPlugin],
  test: {
    include: ['test/**/*.test.ts'],
  },
});

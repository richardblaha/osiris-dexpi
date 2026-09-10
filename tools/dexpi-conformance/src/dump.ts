/** Debug helper: print both extracted DiagramModels for one corpus id. */
import './shim.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ProteusReader } from '../../../src/model/proteus/reader/index.js';
import { projectToView } from '../../../src/model/view/projection.js';
import { loadCorpus } from './corpus.js';
import { extractOurs, extractReference } from './model-extract.js';
import { OFFICIAL_SVG_DIR, REF_SVG_DIR, REPO_ROOT } from './paths.js';

export function dump(id: string): void {
  const entry = loadCorpus().entries.find((e) => e.id === id);
  if (!entry) throw new Error(`no corpus entry ${id}`);

  const xml = fs.readFileSync(path.join(REPO_ROOT, entry.path), 'utf-8');
  const ours = extractOurs(projectToView(ProteusReader.read(xml).model));

  const refSvgPath = [path.join(REF_SVG_DIR, `${id}.svg`), path.join(OFFICIAL_SVG_DIR, `${id}.svg`)].find((p) =>
    fs.existsSync(p)
  );
  const ref = refSvgPath ? extractReference(fs.readFileSync(refSvgPath, 'utf-8')) : null;

  const show = (m: typeof ours) => {
    console.log(`  bbox ${JSON.stringify(m.bbox)}`);
    console.log(`  ${m.symbols.length} symbols:`);
    for (const s of m.symbols)
      console.log(`    ${s.dexpiClass.padEnd(28)} @(${s.cx.toFixed(0)},${s.cy.toFixed(0)}) ${s.w.toFixed(0)}x${s.h.toFixed(0)} ${s.tag ?? ''}`);
    console.log(`  ${m.connections.length} connections, ${m.labels.length} labels`);
  };

  console.log(`\n=== REFERENCE (${refSvgPath ? path.basename(refSvgPath) : 'none'}) ===`);
  if (ref) show(ref);
  console.log(`\n=== OURS ===`);
  show(ours);
}

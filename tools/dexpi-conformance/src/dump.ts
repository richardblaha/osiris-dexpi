/** Debug helper: print both extracted DiagramModels for one corpus id. */
import './shim.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ProteusReader } from '../../../src/model/proteus/reader/index.js';
import { projectToView } from '../../../src/model/view/projection.js';
import { loadCorpus } from './corpus.js';
import { extractOurs, extractReference, loadClassMap } from './model-extract.js';
import { OFFICIAL_SVG_DIR, REF_SVG_DIR, REPO_ROOT } from './paths.js';

export function dump(id: string): void {
  const entry = loadCorpus().entries.find((e) => e.id === id);
  if (!entry) throw new Error(`no corpus entry ${id}`);

  const xml = fs.readFileSync(path.join(REPO_ROOT, entry.path), 'utf-8');
  const ours = extractOurs(projectToView(ProteusReader.read(xml).model));

  const refSvgPath = [path.join(REF_SVG_DIR, `${id}.svg`), path.join(OFFICIAL_SVG_DIR, `${id}.svg`)].find((p) =>
    fs.existsSync(p)
  );
  const classMapPath = path.join(REF_SVG_DIR, `${id}.classmap.json`);
  const classMap = fs.existsSync(classMapPath) ? loadClassMap(classMapPath) : undefined;
  const ref = refSvgPath ? extractReference(fs.readFileSync(refSvgPath, 'utf-8'), classMap) : null;

  const show = (m: typeof ours) => {
    console.log(`  bbox ${JSON.stringify(m.bbox)}`);
    console.log(`  ${m.symbols.length} symbols:`);
    const fmt = (n: number) => (Math.abs(n) >= 5 ? n.toFixed(0) : n.toPrecision(3));
    for (const s of m.symbols)
      console.log(`    ${s.dexpiClass.padEnd(28)} @(${fmt(s.cx)},${fmt(s.cy)}) ${fmt(s.w)}x${fmt(s.h)} ${s.tag ?? ''}`);
    console.log(`  ${m.connections.length} connections, ${m.labels.length} labels`);
  };

  console.log(`\n=== REFERENCE (${refSvgPath ? path.basename(refSvgPath) : 'none'}) ===`);
  if (ref) show(ref);
  console.log(`\n=== OURS ===`);
  show(ours);
}

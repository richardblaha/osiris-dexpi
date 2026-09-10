/**
 * DEXPI conformance suite — single entry point.
 *
 *   node test-output/.bin/cli.mjs <command> [--only <glob>]
 *
 * Commands:
 *   corpus         (re)discover + classify samples/ → fixtures/corpus.json
 *   reference      render pyDEXPI reference SVGs      → test-output/reference/
 *   ours           render our SVG export (headless)   → test-output/ours/
 *   diff           structural + visual comparison     → test-output/report/results.json
 *   report         render the HTML / Markdown report  → test-output/report/
 *   run            corpus → reference → ours → diff → report
 *   symbol-matrix  ISO 10628-2 coverage matrix        → test-output/report/symbol-matrix.*
 *   baseline       copy the current results.json to fixtures/baseline.json
 */
import { buildCorpus, loadCorpus, writeCorpus } from './corpus.js';
import { renderReferences } from './render-reference.js';
import { renderOurs } from './render-ours.js';

function parseArgs(argv: string[]): { cmd: string; only?: string; flags: Set<string> } {
  const [cmd = 'run', ...rest] = argv;
  let only: string | undefined;
  const flags = new Set<string>();
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--only') only = rest[++i];
    else if (rest[i].startsWith('--')) flags.add(rest[i].slice(2));
  }
  return { cmd, only, flags };
}

async function cmdCorpus(): Promise<void> {
  const manifest = buildCorpus();
  writeCorpus(manifest);
  const c = manifest.counts;
  console.log(`corpus: ${manifest.entries.length} sample XML files`);
  console.log(`  proteus-graphics : ${c['proteus-graphics']}  (PASS/FAIL corpus)`);
  console.log(`  semantic-only    : ${c['semantic-only']}  (excluded — no geometry)`);
  console.log(`  unrenderable     : ${c['unrenderable']}  (excluded — parser/data error)`);
  const official = manifest.entries.filter((e) => e.officialSvg).length;
  console.log(`  with official .svg: ${official}`);
}

async function cmdReference(only?: string): Promise<void> {
  const m = await renderReferences(only);
  console.log(`reference (pyDEXPI ${m.pydexpiVersion}):`);
  console.log(`  rendered     : ${m.counts.ok}`);
  console.log(`  unrenderable : ${m.counts.unrenderable}`);
  const withNotes = m.entries.filter((e) => e.notes.length).length;
  const official = m.entries.filter((e) => e.officialSvg).length;
  console.log(`  sanitised    : ${withNotes} (see reference-manifest.json notes)`);
  console.log(`  official svg : ${official}`);
}

async function cmdOurs(only?: string): Promise<void> {
  const m = renderOurs(only);
  console.log('ours (headless ProteusReader → projectToView → exportPidViewToSvg):');
  console.log(`  rendered : ${m.counts.ok}`);
  console.log(`  errors   : ${m.counts.error}`);
  for (const e of m.entries.filter((x) => x.status === 'error').slice(0, 10)) {
    console.log(`    ✗ ${e.id}: ${e.reason}`);
  }
}

async function notImplemented(name: string): Promise<void> {
  console.error(`\`${name}\` is not implemented yet (Phase 2, in progress).`);
  process.exitCode = 2;
}

async function main(): Promise<void> {
  const { cmd, only } = parseArgs(process.argv.slice(2));
  switch (cmd) {
    case 'corpus':
      return cmdCorpus();
    case 'reference':
      return cmdReference(only);
    case 'ours':
      return cmdOurs(only);
    case 'diff':
      return notImplemented('diff');
    case 'report':
      return notImplemented('report');
    case 'symbol-matrix':
      return notImplemented('symbol-matrix');
    case 'baseline':
      return notImplemented('baseline');
    case 'run': {
      await cmdCorpus();
      await cmdReference(only);
      await cmdOurs(only);
      return notImplemented('run (diff/report stages)');
    }
    default:
      console.error(`unknown command: ${cmd}`);
      process.exitCode = 1;
  }
}

void main();

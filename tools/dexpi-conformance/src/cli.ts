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

async function notImplemented(name: string): Promise<void> {
  console.error(`\`${name}\` is not implemented yet (Phase 2, in progress).`);
  process.exitCode = 2;
}

async function main(): Promise<void> {
  const { cmd } = parseArgs(process.argv.slice(2));
  switch (cmd) {
    case 'corpus':
      return cmdCorpus();
    case 'reference':
      return notImplemented('reference');
    case 'ours':
      return notImplemented('ours');
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
      // downstream stages land in later commits
      loadCorpus();
      return notImplemented('run (reference/ours/diff/report stages)');
    }
    default:
      console.error(`unknown command: ${cmd}`);
      process.exitCode = 1;
  }
}

void main();

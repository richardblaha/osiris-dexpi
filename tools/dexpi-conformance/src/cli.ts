/**
 * DEXPI conformance suite — single entry point.
 *
 *   node test-output/.bin/cli.mjs <command> [--only <glob>]
 *
 * Commands:
 *   corpus            (re)discover + classify samples/ → fixtures/corpus.json
 *   reference         render pyDEXPI reference SVGs      → test-output/reference/
 *   ours              render our SVG export (headless)   → test-output/ours/
 *   diff              structural comparison (model-level)→ test-output/report/results.json
 *   visual            headless-Chromium pixel diff       → test-output/report/*.diff.png
 *   report            render the HTML / Markdown report  → test-output/report/
 *   run               corpus → reference → ours → diff → visual → report
 *   dump <id>         print both extracted models for one file
 *   symbol-matrix     ISO 10628-2 coverage matrix        → test-output/report/symbol-matrix.*
 *   baseline          freeze current results             → fixtures/baseline.json
 *   check-regression  compare current run to the baseline (exit 1 on regression)
 *
 * Flags: --only <glob>   filter by corpus id      --no-visual   skip Chromium in `run`
 */
import { buildCorpus, loadCorpus, writeCorpus } from './corpus.js';
import { renderReferences } from './render-reference.js';
import { renderOurs } from './render-ours.js';
import { runDiff } from './structural-diff.js';
import { dump } from './dump.js';
import { renderReport } from './report.js';
import { runVisualDiff } from './visual-diff.js';
import { checkRegression, writeBaseline } from './baseline.js';

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
  console.log(`  proteus-graphics : ${c['proteus-graphics']}  (PASS/FAIL corpus — geometry-rich pyDEXPI reference)`);
  console.log(`  empty-reference  : ${c['empty-reference']}  (pyDEXPI render too sparse to compare)`);
  console.log(`  semantic-only    : ${c['semantic-only']}  (excluded — no geometry)`);
  console.log(`  unrenderable     : ${c['unrenderable']}  (excluded — parser/data error)`);
  const official = manifest.entries.filter((e) => e.officialSvg).length;
  console.log(`  with official .svg: ${official}`);
}

async function cmdReference(only?: string): Promise<void> {
  const m = await renderReferences(only);
  console.log(`reference (pyDEXPI ${m.pydexpiVersion}):`);
  console.log(`  geometry-rich : ${m.counts.ok}`);
  console.log(`  near-empty    : ${m.counts.empty}  (embedded shapes too sparse to compare — single-feature test fixtures)`);
  console.log(`  unrenderable  : ${m.counts.unrenderable}`);
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

async function cmdDiff(only?: string): Promise<void> {
  const r = runDiff(only);
  const s = r.summary;
  console.log('diff (structural):');
  console.log(`  PASS ${s.pass}  WARN ${s.warn}  FAIL ${s.fail}  NO-REFERENCE ${s.noReference}  (of ${s.total})`);
  console.log(`  mean structural score: ${(s.meanStructuralScore * 100).toFixed(1)}%`);
  const cat: Record<string, number> = {};
  for (const row of r.rows) for (const f of row.findings) cat[f.category] = (cat[f.category] || 0) + 1;
  console.log('  findings by category:');
  for (const [k, v] of Object.entries(cat).sort((a, b) => b[1] - a[1])) console.log(`    ${v.toString().padStart(4)}  ${k}`);
}

async function notImplemented(name: string): Promise<void> {
  console.error(`\`${name}\` is not implemented yet (Phase 2, in progress).`);
  process.exitCode = 2;
}

async function main(): Promise<void> {
  const { cmd, only, flags } = parseArgs(process.argv.slice(2));
  switch (cmd) {
    case 'corpus':
      return cmdCorpus();
    case 'reference':
      return cmdReference(only);
    case 'ours':
      return cmdOurs(only);
    case 'diff':
      return cmdDiff(only);
    case 'dump':
      return void dump(process.argv.slice(3).find((a) => !a.startsWith('--')) || '');
    case 'visual':
      return runVisualDiff(only);
    case 'report':
      renderReport();
      console.log(`report → ${new URL('../report/index.html', import.meta.url).pathname}`);
      return;
    case 'symbol-matrix':
      return notImplemented('symbol-matrix');
    case 'baseline':
      return void writeBaseline();
    case 'check-regression':
      process.exitCode = checkRegression();
      return;
    case 'run': {
      await cmdCorpus();
      await cmdReference(only);
      await cmdOurs(only);
      await cmdDiff(only);
      if (!flags.has('no-visual')) {
        try {
          await runVisualDiff(only);
        } catch (e) {
          console.warn(`visual diff skipped: ${e instanceof Error ? e.message : e}`);
        }
      }
      renderReport();
      console.log('report → test-output/report/index.html');
      return;
    }
    default:
      console.error(`unknown command: ${cmd}`);
      process.exitCode = 1;
  }
}

void main();

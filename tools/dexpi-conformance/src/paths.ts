/** Canonical filesystem locations for the conformance suite. */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Walk up from this module until we find the dir holding conformance.config.json. */
function findToolRoot(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, 'conformance.config.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error('could not locate tools/dexpi-conformance (no conformance.config.json above this module)');
}

/** tools/dexpi-conformance/ */
export const TOOL_ROOT = findToolRoot();
/** repository root */
export const REPO_ROOT = path.resolve(TOOL_ROOT, '..', '..');

export const SAMPLES_DIR = path.join(REPO_ROOT, 'samples');
export const FIXTURES_DIR = path.join(TOOL_ROOT, 'fixtures');
export const PYDEXPI_DIR = path.join(TOOL_ROOT, 'pydexpi');
export const VENV_PYTHON = path.join(REPO_ROOT, '.venv', 'bin', 'python');

export const OUT_DIR = path.join(TOOL_ROOT, 'test-output');
export const REF_SVG_DIR = path.join(OUT_DIR, 'reference');
export const OFFICIAL_SVG_DIR = path.join(OUT_DIR, 'reference-official');
export const OURS_SVG_DIR = path.join(OUT_DIR, 'ours');
export const REPORT_DIR = path.join(OUT_DIR, 'report');

export const CORPUS_JSON = path.join(FIXTURES_DIR, 'corpus.json');
export const BASELINE_JSON = path.join(FIXTURES_DIR, 'baseline.json');
export const CONFIG_JSON = path.join(TOOL_ROOT, 'conformance.config.json');
export const REFERENCE_MANIFEST = path.join(OUT_DIR, 'reference-manifest.json');
export const RESULTS_JSON = path.join(REPORT_DIR, 'results.json');

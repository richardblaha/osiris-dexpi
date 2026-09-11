/**
 * Headless "ours" SVG generation — exercises the real editor code path:
 *
 *   ProteusReader.read(xml)  ->  DexpiModel
 *   projectToView(model)     ->  PidView
 *   exportPidViewToSvg(view) ->  SVG string
 *
 * No WebGPU, no webview. `./shim` installs DOMParser/XMLSerializer so the
 * stencil-geometry branch of exportSvg runs. Output: test-output/ours/<id>.svg
 * plus test-output/ours-manifest.json with per-file status.
 */
import './shim.js';

import * as fs from 'node:fs';
import * as path from 'node:path';
import { activeCorpus, loadCorpus } from './corpus.js';
import { OURS_SVG_DIR, OUT_DIR, REPO_ROOT } from './paths.js';
import type { CorpusEntry } from './types.js';

import { ProteusReader } from '../../../src/model/proteus/reader/index.js';
import { projectToView } from '../../../src/model/view/projection.js';
import { exportPidViewToSvg } from '../../../src/webview/exportSvg.js';

export interface OursManifestEntry {
  id: string;
  status: 'ok' | 'error';
  reason?: string;
  svg?: string;
  nodes?: number;
  edges?: number;
  issues?: number;
}

interface OursManifest {
  generatedAt: string;
  counts: { ok: number; error: number };
  entries: OursManifestEntry[];
}

function renderOne(entry: CorpusEntry): OursManifestEntry {
  const inAbs = path.join(REPO_ROOT, entry.path);
  const outAbs = path.join(OURS_SVG_DIR, `${entry.id}.svg`);
  try {
    const xml = fs.readFileSync(inAbs, 'utf-8');
    const { model, issues } = ProteusReader.read(xml);
    const view = projectToView(model);
    const svg = exportPidViewToSvg(view, { theme: 'light', includeBackground: false });
    fs.mkdirSync(path.dirname(outAbs), { recursive: true });
    fs.writeFileSync(outAbs, svg);
    return {
      id: entry.id,
      status: 'ok',
      svg: path.relative(REPO_ROOT, outAbs),
      nodes: view.nodes.length,
      edges: view.edges.length,
      issues: issues.length,
    };
  } catch (err) {
    return {
      id: entry.id,
      status: 'error',
      reason: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
    };
  }
}

export function renderOurs(only?: string): OursManifest {
  const corpus = loadCorpus();
  const filter = only
    ? new RegExp('^' + only.replace(/[.]/g, '\\.').replace(/\*/g, '.*') + '$')
    : null;
  const entries = activeCorpus(corpus).filter((e) => !filter || filter.test(e.id));

  fs.mkdirSync(OURS_SVG_DIR, { recursive: true });
  const results = entries.map(renderOne).sort((a, b) => a.id.localeCompare(b.id));

  const manifest: OursManifest = {
    generatedAt: new Date().toISOString(),
    counts: {
      ok: results.filter((r) => r.status === 'ok').length,
      error: results.filter((r) => r.status === 'error').length,
    },
    entries: results,
  };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'ours-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

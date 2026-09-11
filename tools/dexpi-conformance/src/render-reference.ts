/**
 * Reference-SVG generation via the pyDEXPI wrapper.
 *
 * Runs `pydexpi/wrapper.py` (repo-root .venv Python) over every corpus entry,
 * writes test-output/reference/<id>.svg for the ones that render, copies any
 * official sibling .svg into test-output/reference-official/<id>.svg, and
 * records the per-file outcome in test-output/reference-manifest.json (which
 * `corpus` then folds back in as the authoritative classification).
 */
import { execFile, execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { loadCorpus, buildCorpus, writeCorpus } from './corpus.js';
import {
  OFFICIAL_SVG_DIR,
  OUT_DIR,
  PYDEXPI_DIR,
  REF_SVG_DIR,
  REFERENCE_MANIFEST,
  REPO_ROOT,
  VENV_PYTHON,
} from './paths.js';
import type { CorpusEntry } from './types.js';

const execFileAsync = promisify(execFile);

/** min drawn primitives for a reference SVG to be worth a geometric comparison */
export const MIN_REFERENCE_PRIMITIVES = 15;

export interface ReferenceManifestEntry {
  id: string;
  status: 'ok' | 'empty' | 'unrenderable';
  reason?: string;
  notes: string[];
  primitives?: number; // drawn primitives in the reference SVG
  svg?: string; // repo-relative path to the generated reference SVG
  officialSvg?: string; // repo-relative path to a copied official reference SVG
}

interface ReferenceManifest {
  generatedAt: string;
  pydexpiVersion: string;
  counts: { ok: number; empty: number; unrenderable: number };
  entries: ReferenceManifestEntry[];
}

function pydexpiVersion(): string {
  try {
    const out = execFileSync(
      VENV_PYTHON,
      ['-c', 'import importlib.metadata as m; print(m.version("pyDEXPI"))'],
      { encoding: 'utf-8' }
    );
    return String(out).trim();
  } catch {
    return 'unknown';
  }
}

async function renderOne(entry: CorpusEntry): Promise<ReferenceManifestEntry> {
  const inAbs = path.join(REPO_ROOT, entry.path);
  const outAbs = path.join(REF_SVG_DIR, `${entry.id}.svg`);
  const wrapper = path.join(PYDEXPI_DIR, 'wrapper.py');

  try {
    const { stdout } = await execFileAsync(VENV_PYTHON, [wrapper, inAbs, outAbs], {
      maxBuffer: 16 * 1024 * 1024,
    });
    const res = JSON.parse(stdout.trim().split('\n').pop() || '{}') as {
      status: 'ok' | 'unrenderable';
      reason?: string;
      notes?: string[];
    };
    if (res.status !== 'ok') {
      return { id: entry.id, status: res.status, reason: res.reason || undefined, notes: res.notes ?? [] };
    }
    const prims = (fs.readFileSync(outAbs, 'utf-8').match(/<(polyline|polygon|circle|ellipse|path|rect)\b/g) || []).length;
    const empty = prims < MIN_REFERENCE_PRIMITIVES;
    return {
      id: entry.id,
      status: empty ? 'empty' : 'ok',
      reason: empty
        ? `pyDEXPI reference has only ${prims} drawn primitives — embedded ShapeCatalogue shapes are too sparse for a meaningful geometric comparison (common in the single-feature E/I/P DEXPI test fixtures)`
        : undefined,
      notes: res.notes ?? [],
      primitives: prims,
      svg: path.relative(REPO_ROOT, outAbs),
    };
  } catch (err: unknown) {
    // wrapper exits 1 on unrenderable but still prints JSON on stdout
    const e = err as { stdout?: string; message?: string };
    try {
      const res = JSON.parse((e.stdout || '').trim().split('\n').pop() || '{}') as {
        status: 'ok' | 'unrenderable';
        reason?: string;
        notes?: string[];
      };
      if (res.status) {
        return {
          id: entry.id,
          status: res.status,
          reason: res.reason || undefined,
          notes: res.notes ?? [],
          svg: res.status === 'ok' ? path.relative(REPO_ROOT, outAbs) : undefined,
        };
      }
    } catch {
      /* fall through */
    }
    return {
      id: entry.id,
      status: 'unrenderable',
      reason: `wrapper crashed: ${e.message ?? String(err)}`,
      notes: [],
    };
  }
}

async function pool<T, R>(items: T[], size: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    })
  );
  return out;
}

export async function renderReferences(only?: string): Promise<ReferenceManifest> {
  const corpus = loadCorpus();
  const filter = only ? new RegExp('^' + only.replace(/[.]/g, '\\.').replace(/\*/g, '.*') + '$') : null;
  const entries = corpus.entries.filter((e) => !filter || filter.test(e.id));

  fs.mkdirSync(REF_SVG_DIR, { recursive: true });
  fs.mkdirSync(OFFICIAL_SVG_DIR, { recursive: true });

  const results = await pool(entries, 8, renderOne);

  // Copy official sibling SVGs (independent of pyDEXPI success).
  const byId = new Map(results.map((r) => [r.id, r]));
  for (const e of entries) {
    if (!e.officialSvg) continue;
    const dst = path.join(OFFICIAL_SVG_DIR, `${e.id}.svg`);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(path.join(REPO_ROOT, e.officialSvg), dst);
    const r = byId.get(e.id);
    if (r) r.officialSvg = path.relative(REPO_ROOT, dst);
  }

  const manifest: ReferenceManifest = {
    generatedAt: new Date().toISOString(),
    pydexpiVersion: pydexpiVersion(),
    counts: {
      ok: results.filter((r) => r.status === 'ok').length,
      empty: results.filter((r) => r.status === 'empty').length,
      unrenderable: results.filter((r) => r.status === 'unrenderable').length,
    },
    entries: results.sort((a, b) => a.id.localeCompare(b.id)),
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(REFERENCE_MANIFEST, JSON.stringify(manifest, null, 2) + '\n');

  // Re-derive corpus classification now that we know what actually rendered.
  writeCorpus(buildCorpus());

  return manifest;
}

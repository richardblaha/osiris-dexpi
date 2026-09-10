/**
 * Discovers the sample corpus under samples/ and classifies each PROTEUS XML file.
 *
 * Classification is a two-step process:
 *  1. a cheap structural heuristic here (does the file carry drawing primitives?);
 *  2. authoritative override from test-output/reference-manifest.json once the
 *     pyDEXPI wrapper has actually tried to render each file.
 *
 * Only `proteus-graphics` files enter the PASS/FAIL corpus. The rest are still
 * listed (with a reason) so coverage gaps stay visible.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CORPUS_JSON, FIXTURES_DIR, REFERENCE_MANIFEST, REPO_ROOT, SAMPLES_DIR } from './paths.js';
import type { CorpusClassification, CorpusEntry, CorpusManifest } from './types.js';

const TOOL_VERSION = '0.1.0';

function walkXml(dir: string, acc: string[] = []): string[] {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walkXml(full, acc);
    else if (name.toLowerCase().endsWith('.xml')) acc.push(full);
  }
  return acc;
}

function versionOf(rel: string): string {
  const m = rel.match(/dexpi (\d+\.\d+)/i);
  return m ? m[1] : 'unknown';
}

function taskOf(rel: string): string {
  // The task folder looks like ".../example pids/E01 Tank/E01V01-....xml"
  const parts = rel.split(path.sep);
  for (let i = parts.length - 2; i >= 0; i--) {
    const m = parts[i].match(/^([A-Z]\d{2})\b/);
    if (m) return m[1];
  }
  return 'X00';
}

function slugOf(file: string): string {
  return path
    .basename(file, path.extname(file))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Cheap heuristic: does this Proteus file carry drawing primitives we could render? */
function heuristicClass(xml: string): { klass: CorpusClassification; reason?: string } {
  const hasShapeCat = /<ShapeCatalogue\b/.test(xml);
  const hasPrimitives = /<(PolyLine|Polygon|Circle|Ellipse|Line)\b/.test(xml);
  const hasPositions = /<Position\b/.test(xml);
  const hasExtent = /<Extent\b/.test(xml);
  if ((hasShapeCat && hasPrimitives) || (hasPositions && hasExtent)) {
    return { klass: 'proteus-graphics' };
  }
  return { klass: 'semantic-only', reason: 'no <Position>/<Extent> or <ShapeCatalogue> drawing primitives' };
}

interface ReferenceManifestEntry {
  id: string;
  status: 'ok' | 'unrenderable';
  reason?: string;
}

function loadReferenceManifest(): Map<string, ReferenceManifestEntry> {
  const map = new Map<string, ReferenceManifestEntry>();
  if (!fs.existsSync(REFERENCE_MANIFEST)) return map;
  try {
    const data = JSON.parse(fs.readFileSync(REFERENCE_MANIFEST, 'utf-8')) as {
      entries: ReferenceManifestEntry[];
    };
    for (const e of data.entries) map.set(e.id, e);
  } catch {
    /* ignore a malformed manifest — heuristic still applies */
  }
  return map;
}

export function buildCorpus(): CorpusManifest {
  const files = walkXml(SAMPLES_DIR).sort();
  const refManifest = loadReferenceManifest();
  const seen = new Set<string>();
  const entries: CorpusEntry[] = [];

  for (const file of files) {
    const rel = path.relative(REPO_ROOT, file);
    const version = versionOf(rel);
    const task = taskOf(rel);
    let id = `${version}/${task}/${slugOf(file)}`;
    // Guard against slug collisions across folders.
    if (seen.has(id)) {
      let n = 2;
      while (seen.has(`${id}-${n}`)) n++;
      id = `${id}-${n}`;
    }
    seen.add(id);

    const xml = fs.readFileSync(file, 'utf-8');
    let { klass, reason } = heuristicClass(xml);

    const ref = refManifest.get(id);
    if (ref) {
      if (ref.status === 'ok') {
        klass = 'proteus-graphics';
        reason = undefined;
      } else if (/no <Drawing>|no geometry|carries no/i.test(ref.reason ?? '')) {
        klass = 'semantic-only';
        reason = ref.reason;
      } else {
        klass = 'unrenderable';
        reason = ref.reason ?? 'pyDEXPI wrapper could not render it';
      }
    }

    const officialSvgAbs = file.replace(/\.xml$/i, '.svg');
    const officialSvg = fs.existsSync(officialSvgAbs)
      ? path.relative(REPO_ROOT, officialSvgAbs)
      : undefined;

    entries.push({
      id,
      path: rel,
      version,
      task,
      classification: klass,
      reason,
      officialSvg,
      referenceRendered: ref?.status === 'ok' || undefined,
    });
  }

  const counts: Record<CorpusClassification, number> = {
    'proteus-graphics': 0,
    'semantic-only': 0,
    unrenderable: 0,
  };
  for (const e of entries) counts[e.classification]++;

  return {
    generatedAt: new Date().toISOString(),
    toolVersion: TOOL_VERSION,
    counts,
    entries,
  };
}

export function writeCorpus(manifest: CorpusManifest): void {
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  fs.writeFileSync(CORPUS_JSON, JSON.stringify(manifest, null, 2) + '\n');
}

export function loadCorpus(): CorpusManifest {
  if (!fs.existsSync(CORPUS_JSON)) {
    throw new Error(`corpus.json not found — run \`npm run corpus\` first (${CORPUS_JSON})`);
  }
  return JSON.parse(fs.readFileSync(CORPUS_JSON, 'utf-8')) as CorpusManifest;
}

/** The subset that carries a renderable graphical model. */
export function activeCorpus(manifest: CorpusManifest): CorpusEntry[] {
  return manifest.entries.filter((e) => e.classification === 'proteus-graphics');
}

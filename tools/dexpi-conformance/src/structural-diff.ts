/**
 * Structural comparison of the two DiagramModels.
 *
 * Both sides are normalised into a common frame (translate bbox min → origin,
 * uniform-scale so the bbox diagonal = 1000) before anything is compared, so the
 * pyDEXPI native-mm frame and our (possibly 3×-scaled, Y-flipped) canvas frame
 * line up. Symbols are greedily matched nearest-first; the leftovers are
 * missing/extra. Findings are emitted per category and ranked by severity.
 */
import './shim.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { ProteusReader } from '../../../src/model/proteus/reader/index.js';
import { projectToView } from '../../../src/model/view/projection.js';
import { activeCorpus, loadCorpus } from './corpus.js';
import { extractOurs, extractReference } from './model-extract.js';
import { classesEquivalent } from './class-map.js';
import { CONFIG_JSON, OFFICIAL_SVG_DIR, REF_SVG_DIR, REPO_ROOT, RESULTS_JSON, REPORT_DIR } from './paths.js';
import {
  FINDING_SEVERITY,
  type DiagramModel,
  type DiagramSymbol,
  type Finding,
  type ResultRow,
  type RowStatus,
  type RunResults,
} from './types.js';

interface Config {
  structural: {
    positionToleranceMm: number;
    positionTolerancePct: number;
    sizeTolerancePct: number;
    rotationToleranceDeg: number;
  };
}

function loadConfig(): Config {
  return JSON.parse(fs.readFileSync(CONFIG_JSON, 'utf-8')) as Config;
}

interface NormSymbol extends DiagramSymbol {
  nx: number;
  ny: number;
}

function normalise(model: DiagramModel): { symbols: NormSymbol[]; scale: number; diag: number } {
  const { minX, minY, maxX, maxY } = model.bbox;
  const diag = Math.hypot(maxX - minX, maxY - minY) || 1;
  const scale = 1000 / diag;
  // pyDEXPI keeps DEXPI's Y-up axis (values run negative-down); projectToView
  // already flipped ours to Y-down-from-top. Normalise both to Y-down-from-top.
  const flipY = model.source === 'reference';
  const symbols = model.symbols.map((s) => ({
    ...s,
    nx: (s.cx - minX) * scale,
    ny: (flipY ? maxY - s.cy : s.cy - minY) * scale,
  }));
  return { symbols, scale, diag };
}

/** classes solid enough to anchor a frame alignment on */
const ANCHOR_TOKENS = ['heatexchanger', 'pump', 'vessel', 'tank', 'column', 'compressor', 'drum', 'reactor', 'filter'];
function isAnchorClass(c: string): boolean {
  const n = c.toLowerCase();
  return ANCHOR_TOKENS.some((t) => n.includes(t));
}

/**
 * Least-squares uniform scale + translation taking `ours` onto `ref`, estimated
 * from symbols that match by anchor class. Corrects the systematic frame offset
 * (our 3× canvas scale, differing bbox extents) so the real per-symbol
 * deviations stand out. Returns identity if there aren't enough anchors.
 */
function fitFrame(ref: NormSymbol[], ours: NormSymbol[]): { s: number; tx: number; ty: number } {
  const refAnchors = ref.filter((r) => isAnchorClass(r.dexpiClass));
  const ourAnchors = ours.filter((o) => isAnchorClass(o.dexpiClass));
  const pairs: Array<[NormSymbol, NormSymbol]> = [];
  const used = new Set<NormSymbol>();
  for (const r of refAnchors) {
    let best: NormSymbol | undefined;
    for (const o of ourAnchors) {
      if (used.has(o)) continue;
      if (!classesEquivalent(r.dexpiClass, o.dexpiClass)) continue;
      if (!best) best = o;
    }
    if (best) {
      used.add(best);
      pairs.push([r, best]);
    }
  }
  if (pairs.length < 2) return { s: 1, tx: 0, ty: 0 };

  const oc = { x: 0, y: 0 };
  const rc = { x: 0, y: 0 };
  for (const [r, o] of pairs) {
    oc.x += o.nx;
    oc.y += o.ny;
    rc.x += r.nx;
    rc.y += r.ny;
  }
  oc.x /= pairs.length;
  oc.y /= pairs.length;
  rc.x /= pairs.length;
  rc.y /= pairs.length;

  let num = 0;
  let den = 0;
  for (const [r, o] of pairs) {
    const ox = o.nx - oc.x;
    const oy = o.ny - oc.y;
    num += ox * (r.nx - rc.x) + oy * (r.ny - rc.y);
    den += ox * ox + oy * oy;
  }
  const s = den > 1e-6 ? num / den : 1;
  return { s, tx: rc.x - s * oc.x, ty: rc.y - s * oc.y };
}

/**
 * Greedy match in normalised space, class-aware: a same-class pair is preferred
 * even when a wrong-class symbol sits slightly closer, so instruments don't
 * "steal" an equipment's match. `d` is the true geometric distance.
 */
function matchSymbols(ref: NormSymbol[], ours: NormSymbol[], maxDist: number) {
  const pairs: Array<{ r: NormSymbol; o: NormSymbol; d: number; cost: number }> = [];
  for (const r of ref)
    for (const o of ours) {
      const d = Math.hypot(r.nx - o.nx, r.ny - o.ny);
      if (d > maxDist) continue;
      const classPenalty = classesEquivalent(r.dexpiClass, o.dexpiClass) ? 0 : maxDist * 1.5;
      pairs.push({ r, o, d, cost: d + classPenalty });
    }
  pairs.sort((a, b) => a.cost - b.cost);
  const usedR = new Set<NormSymbol>();
  const usedO = new Set<NormSymbol>();
  const matched: Array<{ r: NormSymbol; o: NormSymbol; d: number }> = [];
  for (const p of pairs) {
    if (usedR.has(p.r) || usedO.has(p.o)) continue;
    usedR.add(p.r);
    usedO.add(p.o);
    matched.push(p);
  }
  return {
    matched,
    missingRef: ref.filter((r) => !usedR.has(r)),
    extraOurs: ours.filter((o) => !usedO.has(o)),
  };
}

function diffOne(id: string, refModel: DiagramModel, ourModel: DiagramModel, cfg: Config): ResultRow {
  const findings: Finding[] = [];
  const add = (category: Finding['category'], message: string, refId?: string, ourId?: string) =>
    findings.push({ category, severity: FINDING_SEVERITY[category], message, refId, ourId });

  const R = normalise(refModel);
  const O = normalise(ourModel);

  // Align ours onto the reference frame using anchor-class symbols.
  const fit = fitFrame(R.symbols, O.symbols);
  const Osym: NormSymbol[] = O.symbols.map((o) => ({
    ...o,
    nx: fit.s * o.nx + fit.tx,
    ny: fit.s * o.ny + fit.ty,
  }));

  // position tolerance in normalised units: max(2mm→norm, 5% of 1000)
  const mmNorm = cfg.structural.positionToleranceMm * (1000 / R.diag);
  const pctNorm = (cfg.structural.positionTolerancePct / 100) * 1000;
  const posTol = Math.max(mmNorm, pctNorm);
  const matchRadius = Math.max(posTol * 3, 120);

  const { matched, missingRef, extraOurs } = matchSymbols(R.symbols, Osym, matchRadius);

  for (const r of missingRef) add('symbol-missing', `reference symbol ${r.dexpiClass} @(${r.cx.toFixed(0)},${r.cy.toFixed(0)}) has no match in ours`, r.id);
  for (const o of extraOurs) add('symbol-extra', `our symbol ${o.dexpiClass} (${o.tag ?? o.id}) has no match in reference`, undefined, o.id);

  for (const { r, o, d } of matched) {
    if (!classesEquivalent(r.dexpiClass, o.dexpiClass))
      add('symbol-class-mismatch', `class differs: reference "${r.dexpiClass}" vs ours "${o.dexpiClass}" (${o.tag ?? o.id})`, r.id, o.id);
    if (d > posTol)
      add('position-off', `position off by ${(d / (1000 / R.diag)).toFixed(1)} mm-equiv (norm ${d.toFixed(0)}) for ${o.dexpiClass} ${o.tag ?? ''}`.trim(), r.id, o.id);
    const rSize = (Math.hypot(r.w, r.h) || 1) * R.scale;
    const oSize = (Math.hypot(o.w, o.h) || 1) * O.scale * fit.s;
    if (Math.abs(oSize - rSize) / rSize > cfg.structural.sizeTolerancePct / 100)
      add('size-off', `size differs >${cfg.structural.sizeTolerancePct}% for ${o.dexpiClass} ${o.tag ?? ''}`.trim(), r.id, o.id);
  }

  // connections — v1: count only, and NON-BLOCKING (see note below). Our model
  // emits one edge per piping segment; pyDEXPI's SVG groups a whole network into
  // one polyline, so the counts legitimately differ. Topology comparison is a
  // later iteration; for now only a gross mismatch is even worth a WARN.
  const refConn = refModel.connections.length;
  const ourConn = ourModel.connections.length;
  const connRatio = Math.max(refConn, ourConn) / Math.max(1, Math.min(refConn, ourConn));
  if (refConn > 0 && ourConn === 0) add('connection-missing', `no connections rendered (reference has ${refConn})`);
  else if (connRatio >= 4) add(ourConn < refConn ? 'connection-missing' : 'connection-extra', `connection count differs ${connRatio.toFixed(1)}× (ours ${ourConn} vs reference ${refConn}) — v1 count-only heuristic`);

  // labels — v1: count only
  if (Math.abs(refModel.labels.length - ourModel.labels.length) > Math.max(2, refModel.labels.length * 0.5))
    add('label-mismatch', `label count differs markedly: reference ${refModel.labels.length} vs ours ${ourModel.labels.length}`);

  findings.sort((a, b) => b.severity - a.severity);

  // v1 blocking set: symbol identity + placement. Connection findings are
  // advisory until topology comparison lands.
  const blockers = findings.filter((f) =>
    ['symbol-missing', 'symbol-extra', 'symbol-class-mismatch', 'position-off', 'rotation-mismatch'].includes(f.category)
  );
  const status: RowStatus = blockers.length === 0 ? (findings.length === 0 ? 'PASS' : 'WARN') : 'FAIL';

  const denom = Math.max(R.symbols.length, O.symbols.length, 1);
  const classMismatches = matched.filter((m) => !classesEquivalent(m.r.dexpiClass, m.o.dexpiClass)).length;
  const penalty = missingRef.length + extraOurs.length + classMismatches;
  const structuralScore = Math.max(0, 1 - penalty / denom);

  return {
    id,
    status,
    structuralScore,
    findings,
    counts: {
      refSymbols: R.symbols.length,
      ourSymbols: O.symbols.length,
      refConnections: refConn,
      ourConnections: ourConn,
    },
  };
}

export function runDiff(only?: string): RunResults {
  const cfg = loadConfig();
  const corpus = loadCorpus();
  const filter = only ? new RegExp('^' + only.replace(/[.]/g, '\\.').replace(/\*/g, '.*') + '$') : null;
  const entries = activeCorpus(corpus).filter((e) => !filter || filter.test(e.id));

  const rows: ResultRow[] = [];
  for (const e of entries) {
    const refSvgPath = path.join(REF_SVG_DIR, `${e.id}.svg`);
    const officialSvgPath = path.join(OFFICIAL_SVG_DIR, `${e.id}.svg`);
    const refPath = fs.existsSync(refSvgPath) ? refSvgPath : fs.existsSync(officialSvgPath) ? officialSvgPath : null;

    if (!refPath) {
      rows.push({
        id: e.id,
        status: 'NO-REFERENCE',
        structuralScore: 0,
        findings: [],
        counts: { refSymbols: 0, ourSymbols: 0, refConnections: 0, ourConnections: 0 },
      });
      continue;
    }

    let ourModel: DiagramModel;
    try {
      const xml = fs.readFileSync(path.join(REPO_ROOT, e.path), 'utf-8');
      const view = projectToView(ProteusReader.read(xml).model);
      ourModel = extractOurs(view);
    } catch (err) {
      rows.push({
        id: e.id,
        status: 'FAIL',
        structuralScore: 0,
        findings: [
          {
            category: 'symbol-missing',
            severity: FINDING_SEVERITY['symbol-missing'],
            message: `ours failed to render: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        counts: { refSymbols: 0, ourSymbols: 0, refConnections: 0, ourConnections: 0 },
      });
      continue;
    }

    const refModel = extractReference(fs.readFileSync(refPath, 'utf-8'));
    rows.push(diffOne(e.id, refModel, ourModel, cfg));
  }

  rows.sort((a, b) => a.id.localeCompare(b.id));
  const pass = rows.filter((r) => r.status === 'PASS').length;
  const warn = rows.filter((r) => r.status === 'WARN').length;
  const fail = rows.filter((r) => r.status === 'FAIL').length;
  const noRef = rows.filter((r) => r.status === 'NO-REFERENCE').length;
  const scored = rows.filter((r) => r.status !== 'NO-REFERENCE');

  const results: RunResults = {
    generatedAt: new Date().toISOString(),
    config: cfg,
    rows,
    summary: {
      total: rows.length,
      pass,
      warn,
      fail,
      noReference: noRef,
      meanStructuralScore: scored.length ? scored.reduce((s, r) => s + r.structuralScore, 0) / scored.length : 0,
    },
  };

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(RESULTS_JSON, JSON.stringify(results, null, 2) + '\n');
  return results;
}

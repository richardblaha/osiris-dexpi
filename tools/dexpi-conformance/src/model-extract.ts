/**
 * Turns each side into a normalised, renderer-agnostic `DiagramModel`
 * (symbols / connections / labels / bbox), so the structural diff never has to
 * reason about raw SVG structure.
 *
 *  - ours:      straight from the editor's PidView (we own that shape).
 *  - reference: parsed out of the pyDEXPI SVG — each `<g class="representation-
 *               group">` becomes a symbol (bbox + centroid + shape hint) unless
 *               it is a label or a bare pipe run.
 *
 * v1 limitation: the reference side derives `dexpiClass` from the pyDEXPI shape
 * name (e.g. `PLATE_TYPE_HEAT_EXCHANGER_SHAPE` → `PlateTypeHeatExchanger`), not
 * from the conceptual model, and connection topology is endpoint-snapping only.
 * Both are good enough for the baseline and are refined later.
 */
import './shim.js';

import * as fs from 'node:fs';
import type { PidView } from '../../../src/model/view/projection.js';
import type { DiagramConnection, DiagramLabel, DiagramModel, DiagramSymbol } from './types.js';
import { bboxValid, merge, subtreeBBox, subtreePolylines, type BBox } from './svg-geom.js';

function centroid(b: BBox) {
  return { cx: (b.minX + b.maxX) / 2, cy: (b.minY + b.maxY) / 2, w: b.maxX - b.minX, h: b.maxY - b.minY };
}

/** `PLATE_TYPE_HEAT_EXCHANGER_SHAPE` → `PlateTypeHeatExchanger` */
export function shapeNameToClass(name: string): string {
  return name
    .replace(/_SHAPE$/i, '')
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join('');
}

// ---------------------------------------------------------------- ours

export function extractOurs(view: PidView): DiagramModel {
  const symbols: DiagramSymbol[] = [];
  for (const n of view.nodes) {
    if (n.kind === 'nozzle') continue; // nozzles are ports, compared separately later
    symbols.push({
      id: n.id,
      dexpiClass: n.dexpiClass || 'Unknown',
      kind: n.kind,
      cx: n.x + (n.w || 0) / 2,
      cy: n.y + (n.h || 0) / 2,
      w: n.w || 0,
      h: n.h || 0,
      rotation: n.rotation || 0,
      mirrored: !!n.mirrored,
      tag: n.tagName || undefined,
    });
  }
  const connections: DiagramConnection[] = view.edges.map((e) => ({
    id: e.id,
    kind: e.lineKind === 'signal' || e.kind === 'signal' ? 'signal' : 'pipe',
    fromSymbol: e.sourceId || undefined,
    toSymbol: e.targetId || undefined,
    polyline: (e.waypoints || []).map((p) => ({ x: p.x, y: p.y })),
  }));
  const labels: DiagramLabel[] = view.labels.map((l) => ({ text: l.text, x: l.x, y: l.y, ownerId: l.parentId }));

  let bb: BBox = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const s of symbols) bb = merge(bb, { minX: s.cx - s.w / 2, minY: s.cy - s.h / 2, maxX: s.cx + s.w / 2, maxY: s.cy + s.h / 2 });
  for (const c of connections) for (const p of c.polyline) bb = merge(bb, { minX: p.x, minY: p.y, maxX: p.x, maxY: p.y });

  return {
    source: 'ours',
    symbols,
    connections,
    labels,
    bbox: bboxValid(bb) ? bb : { minX: 0, minY: 0, maxX: 1, maxY: 1 },
  };
}

// ------------------------------------------------------------ reference

function isLabelGroup(g: Element): boolean {
  const cls = (g.getAttribute('class') || '').toLowerCase();
  if (cls.includes('label')) return true;
  // only-text content → treat as label
  const hasShape = g.getElementsByTagName('polyline').length + g.getElementsByTagName('polygon').length +
    g.getElementsByTagName('circle').length + g.getElementsByTagName('ellipse').length + g.getElementsByTagName('path').length;
  const hasText = g.getElementsByTagName('text').length;
  return hasText > 0 && hasShape === 0;
}

function innerShapeName(g: Element): string | undefined {
  const kids = g.getElementsByTagName('g');
  for (let i = 0; i < kids.length; i++) {
    const id = kids[i].getAttribute('id');
    if (id && /_SHAPE$/i.test(id)) return id;
  }
  return undefined;
}

/** representation-group nested inside another representation-group? */
function isNested(g: Element): boolean {
  let p = g.parentNode as Element | null;
  while (p && p.nodeType === 1) {
    if ((p.getAttribute && p.getAttribute('class')) === 'representation-group') return true;
    p = p.parentNode as Element | null;
  }
  return false;
}

export type ReferenceClassMap = Map<string, { class: string; tag?: string | null }>;

/** Loads a `<id>.classmap.json` written by pydexpi/model_dump.py. */
export function loadClassMap(jsonPath: string): ReferenceClassMap | undefined {
  try {
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as {
      groups: Record<string, { class: string; tag?: string | null }>;
    };
    return new Map(Object.entries(data.groups));
  } catch {
    return undefined;
  }
}

export function extractReference(svg: string, classMap?: ReferenceClassMap): DiagramModel {
  const doc = new DOMParser().parseFromString(svg, 'text/xml');
  const groups = Array.from(doc.getElementsByTagName('g')).filter(
    (g) => g.getAttribute('class') === 'representation-group'
  );

  const seen = new Set<string>();
  const symbols: DiagramSymbol[] = [];
  const labels: DiagramLabel[] = [];
  const connections: DiagramConnection[] = [];
  let bb: BBox = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };

  for (const g of groups) {
    const id = g.getAttribute('id') || `rg-${symbols.length}`;
    if (seen.has(id)) continue;
    if (g.childNodes.length === 0) continue; // the self-closing duplicate
    seen.add(id);

    const box = subtreeBBox(g);
    if (!bboxValid(box)) continue;
    const c = centroid(box);

    // Authoritative class from pyDEXPI's conceptual model (model_dump.py),
    // keyed by this same RepresentationGroup id. This works regardless of
    // nesting depth — a valve sitting inside a piping-network wrapper group is
    // just as real a symbol as a top-level piece of equipment.
    const known = classMap?.get(id);
    if (known) {
      if (known.class === 'Nozzle') continue; // ours excludes nozzles from symbols[] too
      bb = merge(bb, box);
      if (known.class === 'PipingNetworkSegment') {
        // A segment is a connection in `ours` (an edge), not a symbol — route
        // it the same way here, using its longest drawn polyline as the run.
        const polys = subtreePolylines(g);
        const longest = polys.sort((a, b) => b.length - a.length)[0] || [];
        connections.push({ id, kind: 'pipe', polyline: longest.map(([x, y]) => ({ x, y })) });
        continue;
      }
      symbols.push({
        id,
        dexpiClass: known.class,
        kind: 'equipment',
        cx: c.cx,
        cy: c.cy,
        w: c.w,
        h: c.h,
        rotation: 0,
        mirrored: false,
        tag: known.tag ?? undefined,
      });
      continue;
    }

    // No conceptual-model hit (classMap absent, or this is a structural
    // wrapper group / pipe run with no represented object) — fall back to the
    // shape-name heuristic, then the label / thin-pipe heuristics.
    if (isNested(g)) continue; // avoid double-counting a wrapper's own bbox as a symbol
    bb = merge(bb, box);

    if (isLabelGroup(g)) {
      const t = g.getElementsByTagName('text')[0];
      labels.push({ text: (t && t.textContent) || '', x: c.cx, y: c.cy });
      continue;
    }

    const shape = innerShapeName(g);
    const cls = (g.getAttribute('class') || '').toLowerCase();

    // a bare pipe run: no *_SHAPE, thin & long, made of polylines
    const thin = Math.min(c.w, c.h) < Math.max(c.w, c.h) * 0.15;
    if (!shape && (cls.includes('pipe') || thin)) {
      const polys = subtreePolylines(g);
      const longest = polys.sort((a, b) => b.length - a.length)[0] || [];
      connections.push({
        id,
        kind: 'pipe',
        polyline: longest.map(([x, y]) => ({ x, y })),
      });
      continue;
    }

    if (shape) {
      symbols.push({
        id,
        dexpiClass: shapeNameToClass(shape),
        kind: 'equipment',
        cx: c.cx,
        cy: c.cy,
        w: c.w,
        h: c.h,
        rotation: 0,
        mirrored: false,
      });
    }
  }

  return {
    source: 'reference',
    symbols,
    connections,
    labels,
    bbox: bboxValid(bb) ? bb : { minX: 0, minY: 0, maxX: 1, maxY: 1 },
  };
}

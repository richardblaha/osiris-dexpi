/**
 * High-Fidelity SVG Vector Diagram Exporter for DEXPI P&ID Schematics.
 *
 * Renders complete P&ID drawings including authentic stencil shapes, nozzle ports,
 * flow direction arrows (ISO 10628), pipe styles (process vs. signal), and labels.
 */

import type { PidView, PidViewNode, PidViewEdge } from '../model/view/projection';
import type { GraphicPrimitive } from '../model/classes/graphics';
import { boundsOfPrimitives, type Bounds } from '../model/shapeGeometry';
import { JumperDetector } from '../webgpu/routing/jumperDetector';

export interface SvgExportOptions {
  theme?: 'dark' | 'light';
  padding?: number;
  includeBackground?: boolean;
}

export interface DiagramMarkupOptions {
  theme?: 'dark' | 'light';
  /** Whether to draw flow-direction arrow glyphs on pipe segments. Callers that already
   *  render their own (e.g. the live interaction overlay) should pass `false` to avoid doubling up. */
  includeFlowArrows?: boolean;
}

export function exportPidViewToSvg(view: PidView, options: SvgExportOptions = {}): string {
  if (!view || (!view.nodes.length && !view.edges.length)) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"></svg>';
  }

  const pad = options.padding ?? 50;

  // 1. Calculate diagram bounding box
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const n of view.nodes) {
    const w = n.w || 40;
    const h = n.h || 40;
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + w);
    maxY = Math.max(maxY, n.y + h + (n.tagName ? 20 : 0));
  }

  for (const e of view.edges) {
    for (const p of e.waypoints || []) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }

  if (!isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 800;
    maxY = 600;
  }

  const vbX = Math.round(minX - pad);
  const vbY = Math.round(minY - pad);
  const vbW = Math.max(200, Math.round(maxX - minX + pad * 2));
  const vbH = Math.max(150, Math.round(maxY - minY + pad * 2));

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vbX} ${vbY} ${vbW} ${vbH}" width="${vbW}" height="${vbH}">`
  );

  if (options.includeBackground !== false) {
    const bgColor = options.theme === 'light' ? '#ffffff' : '#161a22';
    parts.push(`<rect x="${vbX}" y="${vbY}" width="${vbW}" height="${vbH}" fill="${bgColor}" />`);
  }

  parts.push(renderPidViewDiagramMarkup(view, { theme: options.theme, includeFlowArrows: true }));
  parts.push('</svg>');
  return parts.join('\n');
}

/**
 * Renders the actual diagram content (stencil shapes, piping, labels) as an SVG
 * fragment — `<defs>` + `<g id="pipelines">` + `<g id="symbols">` — using real-world
 * coordinates and no outer `<svg>`/viewBox of its own. Shared by `exportPidViewToSvg`
 * (which wraps it with a computed viewBox for standalone export) and the live
 * on-screen `DiagramSvgLayer`, which wraps it with a viewBox tracking the pan/zoom camera.
 */
export function renderPidViewDiagramMarkup(view: PidView, options: DiagramMarkupOptions = {}): string {
  const isDark = options.theme !== 'light';
  const includeFlowArrows = options.includeFlowArrows !== false;

  // Palette and style definitions
  const pipeProcessColor = isDark ? '#f0f4f8' : '#1e293b';
  const pipeSignalColor = isDark ? '#00f2fe' : '#0284c7';
  const equipStroke = isDark ? '#f0f4f8' : '#0f172a';
  const equipFill = isDark ? '#212836' : '#f8fafc';
  const valveStroke = isDark ? '#00f2fe' : '#0284c7';
  const valveFill = isDark ? '#0b2230' : '#e0f2fe';
  const instStroke = isDark ? '#e0e8f0' : '#334155';
  const instFill = isDark ? '#19222c' : '#f1f5f9';
  const nozzleStroke = isDark ? '#a0c0d0' : '#475569';
  const nozzleFill = isDark ? '#283240' : '#e2e8f0';
  const tagColor = isDark ? '#00f2fe' : '#0369a1';
  const labelColor = isDark ? '#94a3b8' : '#64748b';

  const parts: string[] = [];

  parts.push('<defs>');
  parts.push('<style>');
  parts.push(`
    .pipe-process { stroke: ${pipeProcessColor}; stroke-width: 2.5px; fill: none; stroke-linecap: round; stroke-linejoin: round; }
    .pipe-signal { stroke: ${pipeSignalColor}; stroke-width: 1.5px; stroke-dasharray: 5,4; fill: none; stroke-linecap: round; stroke-linejoin: round; }
    .flow-arrow-process { fill: ${pipeProcessColor}; stroke: ${pipeProcessColor}; stroke-width: 1px; }
    .flow-arrow-signal { fill: ${pipeSignalColor}; stroke: ${pipeSignalColor}; stroke-width: 1px; }
    .equip-shape { stroke: ${equipStroke}; fill: ${equipFill}; stroke-width: 2px; stroke-linejoin: round; stroke-linecap: round; }
    .valve-shape { stroke: ${valveStroke}; fill: ${valveFill}; stroke-width: 2px; stroke-linejoin: round; stroke-linecap: round; }
    .inst-shape { stroke: ${instStroke}; fill: ${instFill}; stroke-width: 2px; stroke-linejoin: round; stroke-linecap: round; }
    .nozzle-shape { stroke: ${nozzleStroke}; fill: ${nozzleFill}; stroke-width: 1.5px; stroke-linejoin: round; }
    .tag-text { fill: ${tagColor}; font-family: 'osifont', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 11px; font-weight: 600; text-anchor: middle; }
    .sub-tag { fill: ${labelColor}; font-family: 'osifont', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 8px; font-weight: 600; text-anchor: middle; }
    .line-label { fill: ${labelColor}; font-family: 'osifont', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 9px; text-anchor: middle; }
  `);
  parts.push('</style>');
  parts.push('</defs>');

  // 3. Render Pipelines & Edges (underneath symbols)
  parts.push('<g id="pipelines">');

  const edgeInputs = view.edges
    .filter((e) => e.waypoints && e.waypoints.length >= 2)
    .map((e) => {
      const isSignal = e.lineKind === 'signal' || e.kind === 'signal';
      return {
        id: e.id,
        points: e.waypoints,
        isSignal,
        priority: isSignal ? 10 : 100,
      };
    });

  const jumperResults = JumperDetector.processEdges(edgeInputs, {
    jumperRadius: 6,
    horizontalPriorityBonus: 10,
  });

  for (const edge of view.edges) {
    const isSignal = edge.lineKind === 'signal' || edge.kind === 'signal';
    const pipeClass = isSignal ? 'pipe-signal' : 'pipe-process';
    const arrowClass = isSignal ? 'flow-arrow-signal' : 'flow-arrow-process';

    if (edge.waypoints && edge.waypoints.length >= 2) {
      const processed = jumperResults.get(edge.id);
      let pathD = processed?.svgPathD;
      if (!pathD) {
        pathD = '';
        for (let i = 0; i < edge.waypoints.length; i++) {
          pathD += (i === 0 ? 'M ' : ' L ') + `${edge.waypoints[i].x} ${edge.waypoints[i].y}`;
        }
      }
      parts.push(`<path class="${pipeClass}" d="${pathD}" />`);

      // Flow direction arrows at segment midpoints
      let longestSegLen = 0;
      let longestSegMid = { x: 0, y: 0 };

      for (let i = 0; i < edge.waypoints.length - 1; i++) {
        const p1 = edge.waypoints[i];
        const p2 = edge.waypoints[i + 1];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.hypot(dx, dy);

        if (len > longestSegLen) {
          longestSegLen = len;
          longestSegMid = { x: (p1.x + p2.x) * 0.5, y: (p1.y + p2.y) * 0.5 };
        }

        // Draw flow arrow if segment is long enough
        if (includeFlowArrows && len >= 24) {
          const mx = (p1.x + p2.x) * 0.5;
          const my = (p1.y + p2.y) * 0.5;
          const ux = dx / len;
          const uy = dy / len;
          const px = -uy;
          const py = ux;

          const tipX = (mx + ux * 5).toFixed(1);
          const tipY = (my + uy * 5).toFixed(1);
          const b1X = (mx - ux * 4 + px * 4).toFixed(1);
          const b1Y = (my - uy * 4 + py * 4).toFixed(1);
          const b2X = (mx - ux * 4 - px * 4).toFixed(1);
          const b2Y = (my - uy * 4 - py * 4).toFixed(1);

          parts.push(
            `<polygon class="${arrowClass}" points="${tipX},${tipY} ${b1X},${b1Y} ${b2X},${b2Y}" />`
          );
        }
      }

      // Render line label / fluid code along longest segment
      const lineText = edge.fluidCode || edge.label;
      if (lineText && longestSegLen > 40) {
        parts.push(
          `<text class="line-label" x="${longestSegMid.x.toFixed(1)}" y="${(longestSegMid.y - 6).toFixed(1)}">${lineText}</text>`
        );
      }
    }
  }
  parts.push('</g>');

  // 4. Render Nodes & Stencils
  const labelCandidates: LabelCandidate[] = [];

  parts.push('<g id="symbols">');
  for (const node of view.nodes) {
    // Skip standalone child nozzles here; they are rendered with their parent equipment
    if (node.kind === 'nozzle' && node.parentId) continue;

    const w = node.w || 40;
    const h = node.h || 40;
    const cx = node.x + w * 0.5;
    const cy = node.y + h * 0.5;
    const rot = node.rotation || 0;
    const mir = node.mirrored ? -1 : 1;

    let transform = `translate(${cx.toFixed(1)}, ${cy.toFixed(1)})`;
    if (rot !== 0 || mir !== 1) {
      transform += ` rotate(${rot}) scale(${mir}, 1)`;
    }
    transform += ` translate(${(-w * 0.5).toFixed(1)}, ${(-h * 0.5).toFixed(1)})`;

    parts.push(`<g id="${node.id}" transform="${transform}">`);
    renderNodeBody(node, w, h, parts);
    parts.push('</g>');

    // Tag name label (always upright, not rotated/mirrored) — collected now,
    // placed after every shape is known so overlapping labels can be nudged
    // apart instead of stacking on top of each other.
    if (node.tagName) {
      addLabelCandidate(labelCandidates, node.tagName, cx, node.y + h + 14, 'tag-text', 11);
    }

    // Render explicit child nozzles attached to this equipment
    const childNozzles = view.nodes.filter((n) => n.parentId === node.id && n.kind === 'nozzle');
    for (const noz of childNozzles) {
      const nw = noz.w || 8;
      const nh = noz.h || 8;
      parts.push(
        `<rect class="nozzle-shape" x="${noz.x}" y="${noz.y}" width="${nw}" height="${nh}" rx="1" />`
      );
      if (noz.tagName) {
        addLabelCandidate(labelCandidates, noz.tagName, noz.x + nw * 0.5, noz.y - 3, 'sub-tag', 8);
      }
    }
  }
  parts.push('</g>');

  // 5. Render Labels — on top of every shape, nudged apart where they'd overlap.
  parts.push('<g id="labels">');
  for (const box of resolveLabelCollisions(labelCandidates)) {
    parts.push(`<text class="${box.cls}" x="${box.x.toFixed(1)}" y="${box.y.toFixed(1)}">${box.text}</text>`);
  }
  parts.push('</g>');

  return parts.join('\n');
}

interface LabelCandidate {
  text: string;
  /** Anchor is horizontally centered on `x`, baseline at `y` (matches `text-anchor: middle`). */
  x: number;
  y: number;
  w: number;
  h: number;
  cls: string;
}

/** Rough (monospace-ish) text width estimate — no DOM/canvas metrics available at export time. */
function addLabelCandidate(out: LabelCandidate[], text: string, x: number, y: number, cls: string, fontSize: number): void {
  out.push({ text, x, y, w: text.length * fontSize * 0.6, h: fontSize * 1.2, cls });
}

/**
 * Greedily nudges each label straight down, in placement order, until it no
 * longer overlaps an already-placed label's box. Not a true force-directed
 * layout — just enough to stop adjacent small components' tags from stacking
 * directly on top of each other, which is the common case on a dense P&ID.
 */
function resolveLabelCollisions(candidates: LabelCandidate[]): LabelCandidate[] {
  const placed: LabelCandidate[] = [];
  const padding = 1;
  const maxAttempts = 8;

  for (const candidate of candidates) {
    let box = { ...candidate };
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const overlapping = placed.find((p) => boxesOverlap(box, p, padding));
      if (!overlapping) break;
      box = { ...box, y: box.y + box.h + padding };
    }
    placed.push(box);
  }

  return placed;
}

function boxesOverlap(a: LabelCandidate, b: LabelCandidate, padding: number): boolean {
  const aLeft = a.x - a.w / 2 - padding;
  const aRight = a.x + a.w / 2 + padding;
  const aTop = a.y - a.h - padding;
  const aBottom = a.y + padding;
  const bLeft = b.x - b.w / 2 - padding;
  const bRight = b.x + b.w / 2 + padding;
  const bTop = b.y - b.h - padding;
  const bBottom = b.y + padding;
  return aLeft < bRight && aRight > bLeft && aTop < bBottom && aBottom > bTop;
}

function renderNodeBody(node: PidViewNode, w: number, h: number, out: string[]): void {
  const styleClass =
    node.kind === 'equipment'
      ? 'equip-shape'
      : node.kind === 'instrument'
      ? 'inst-shape'
      : node.kind === 'nozzle'
      ? 'nozzle-shape'
      : 'valve-shape';

  // Draw directly from the document's own DEXPI graphics data — primitives
  // embedded on the element itself, or a `<ShapeCatalogue>` `Shape` referenced
  // by its `ComponentName` — exactly the two sources pyDEXPI's own renderer
  // draws from (`EquipmentParser.drawing_pass`). No fixed/pre-baked shape
  // library is consulted.
  const primitives = node.symbolPrimitives ?? node.symbolShape?.primitives;
  const bounds = boundsOfPrimitives(primitives);
  if (primitives && bounds && bounds.w > 0 && bounds.h > 0) {
    out.push(renderPrimitives(primitives, bounds, w, h, styleClass));
    return;
  }

  // No geometry available anywhere in the document for this element — a
  // neutral placeholder, not a guessed/pre-baked shape.
  out.push(`<rect class="${styleClass}" x="0" y="0" width="${w}" height="${h}" rx="2" />`);
}

/**
 * Renders `GraphicPrimitive`s scaled-to-fit from their own native `bounds` into
 * a `w`x`h` box, flipping Y (DEXPI's graphics coordinates are math-convention
 * Y-up; SVG is Y-down) — the same `to_svg_y` treatment pyDEXPI's `svg_loader.py`
 * applies. `Text`/`TextTemplate` primitives are skipped: tag/label text is
 * already rendered separately (see the `labelCandidates` pass below).
 */
function renderPrimitives(
  primitives: GraphicPrimitive[],
  bounds: Bounds,
  w: number,
  h: number,
  styleClass: string
): string {
  const sx = bounds.w > 0 ? w / bounds.w : 1;
  const sy = bounds.h > 0 ? h / bounds.h : 1;
  const tx = (x: number) => ((x - bounds.minX) * sx).toFixed(2);
  const ty = (y: number) => ((bounds.maxY - y) * sy).toFixed(2);

  const parts: string[] = [];
  for (const prim of primitives) {
    if ('kind' in prim && prim.kind === 'polyline') {
      const pts = prim.points.map((p) => `${tx(p.x)},${ty(p.y)}`).join(' ');
      parts.push(`<polyline class="${styleClass}" points="${pts}" />`);
    } else if ('kind' in prim && prim.kind === 'polygon') {
      const pts = prim.points.map((p) => `${tx(p.x)},${ty(p.y)}`).join(' ');
      parts.push(`<polygon class="${styleClass}" points="${pts}" />`);
    } else if ('radius' in prim) {
      const c = prim.position?.location ?? { x: 0, y: 0 };
      parts.push(
        `<ellipse class="${styleClass}" cx="${tx(c.x)}" cy="${ty(c.y)}" rx="${(prim.radius * sx).toFixed(2)}" ry="${(prim.radius * sy).toFixed(2)}" />`
      );
    } else if ('startAngle' in prim) {
      parts.push(renderEllipseArcPath(prim, tx, ty, sx, sy, styleClass));
    } else if ('majorRadius' in prim) {
      const c = prim.position?.location ?? { x: 0, y: 0 };
      parts.push(
        `<ellipse class="${styleClass}" cx="${tx(c.x)}" cy="${ty(c.y)}" rx="${(prim.majorRadius * sx).toFixed(2)}" ry="${(prim.minorRadius * sy).toFixed(2)}" />`
      );
    }
    // Text / TextTemplate: intentionally not drawn here — see doc comment above.
  }
  return parts.join('\n');
}

function renderEllipseArcPath(
  arc: Extract<GraphicPrimitive, { startAngle: number }>,
  tx: (x: number) => string,
  ty: (y: number) => string,
  sx: number,
  sy: number,
  styleClass: string
): string {
  const c = arc.position?.location ?? { x: 0, y: 0 };
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const startX = c.x + arc.majorRadius * Math.cos(toRad(arc.startAngle));
  const startY = c.y + arc.minorRadius * Math.sin(toRad(arc.startAngle));
  const endX = c.x + arc.majorRadius * Math.cos(toRad(arc.endAngle));
  const endY = c.y + arc.minorRadius * Math.sin(toRad(arc.endAngle));

  let span = arc.endAngle - arc.startAngle;
  span = ((span % 360) + 360) % 360;
  const largeArc = span > 180 ? 1 : 0;

  const rx = (arc.majorRadius * sx).toFixed(2);
  const ry = (arc.minorRadius * sy).toFixed(2);
  return `<path class="${styleClass}" d="M ${tx(startX)} ${ty(startY)} A ${rx} ${ry} 0 ${largeArc} 0 ${tx(endX)} ${ty(endY)}" fill="none" />`;
}

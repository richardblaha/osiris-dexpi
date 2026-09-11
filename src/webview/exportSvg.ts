/**
 * High-Fidelity SVG Vector Diagram Exporter for DEXPI P&ID Schematics.
 *
 * Renders complete P&ID drawings including authentic stencil shapes, nozzle ports,
 * flow direction arrows (ISO 10628), pipe styles (process vs. signal), and labels.
 */

import type { PidView, PidViewNode, PidViewEdge } from '../model/view/projection';
import { catalogStencilFor, SymbolElementType } from '../maxgraph/stencils/catalog';
import { getStencilXml } from '../maxgraph/stencils/registry';
import { JumperDetector } from '../webgpu/routing/jumperDetector';
import { getComponentShape, type ShapePrimitive } from '../model/componentShapes';

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

    // Tag name label (always upright, not rotated/mirrored)
    if (node.tagName) {
      const tagY = node.y + h + 14;
      parts.push(
        `<text class="tag-text" x="${cx.toFixed(1)}" y="${tagY.toFixed(1)}">${node.tagName}</text>`
      );
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
        parts.push(
          `<text class="sub-tag" x="${(noz.x + nw * 0.5).toFixed(1)}" y="${(noz.y - 3).toFixed(1)}">${noz.tagName}</text>`
        );
      }
    }
  }
  parts.push('</g>');

  return parts.join('\n');
}

function resolveElementType(kind: string): SymbolElementType {
  if (kind === 'equipment') return 'Equipment';
  if (kind === 'instrument') return 'ProcessInstrument';
  return 'PipingComponent';
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

  // The real Proteus `ComponentName` (e.g. "VESSEL_WITH_DISHED_HEADS_SHAPE") is a
  // far more precise signal for which symbol to draw than guessing from the DEXPI
  // class alone — try it first.
  const knownShape = getComponentShape(node.componentName);
  if (knownShape) {
    const rendered = renderComponentShape(knownShape, w, h, styleClass);
    if (rendered) {
      out.push(rendered);
      return;
    }
  }

  const elemType = resolveElementType(node.kind);
  const stencilId = catalogStencilFor(elemType, node.dexpiClass || '');
  const stencilXml = getStencilXml(stencilId);

  if (stencilXml) {
    const rendered = renderStencilGeometry(stencilXml, w, h, styleClass);
    if (rendered) {
      out.push(rendered);
      return;
    }
  }

  // Fallback parametric CAD geometries matching WebGPU slices
  renderFallbackGeometry(node, w, h, styleClass, out);
}

/** Renders a precise `componentShapes.ts` definition, stretched from its native box to `w` x `h`. */
function renderComponentShape(
  shape: { w: number; h: number; primitives: ShapePrimitive[] },
  w: number,
  h: number,
  styleClass: string
): string | null {
  if (shape.primitives.length === 0) return null;

  const sx = shape.w > 0 ? w / shape.w : 1;
  const sy = shape.h > 0 ? h / shape.h : 1;
  const tx = (x: number) => (x * sx).toFixed(2);
  const ty = (y: number) => (y * sy).toFixed(2);

  const parts: string[] = [];
  for (const prim of shape.primitives) {
    if (prim.kind === 'polyline') {
      const pts = prim.points.map(([x, y]) => `${tx(x)},${ty(y)}`).join(' ');
      parts.push(`<polyline class="${styleClass}" points="${pts}" />`);
    } else if (prim.kind === 'ellipse') {
      if (prim.fillBackground) {
        parts.push(
          `<ellipse class="${styleClass}" cx="${tx(prim.cx)}" cy="${ty(prim.cy)}" rx="${(prim.rx * sx).toFixed(2)}" ry="${(prim.ry * sy).toFixed(2)}" style="fill: var(--canvas-bg, #161a22)" />`
        );
      }
      parts.push(
        `<ellipse class="${styleClass}" cx="${tx(prim.cx)}" cy="${ty(prim.cy)}" rx="${(prim.rx * sx).toFixed(2)}" ry="${(prim.ry * sy).toFixed(2)}" />`
      );
    } else if (prim.kind === 'arc') {
      const rx = (prim.r * sx).toFixed(2);
      const ry = (prim.r * sy).toFixed(2);
      parts.push(
        `<path class="${styleClass}" d="M ${tx(prim.from[0])} ${ty(prim.from[1])} A ${rx} ${ry} 0 ${prim.largeArc ?? 0} ${prim.sweep ?? 0} ${tx(prim.to[0])} ${ty(prim.to[1])}" />`
      );
    }
  }
  return parts.join('\n');
}

function renderStencilGeometry(
  shapeXml: string,
  w: number,
  h: number,
  styleClass: string
): string | null {
  try {
    if (typeof DOMParser === 'undefined') return null;
    const doc = new DOMParser().parseFromString(shapeXml, 'text/xml');
    const shape = doc.getElementsByTagName('shape')[0];
    if (!shape) return null;

    const w0 = Number(shape.getAttribute('w')) || 100;
    const h0 = Number(shape.getAttribute('h')) || 100;
    const sx = w / w0;
    const sy = h / h0;

    const tx = (x: number) => x * sx;
    const ty = (y: number) => y * sy;

    const parts: string[] = [];
    for (const section of ['background', 'foreground']) {
      const el = shape.getElementsByTagName(section)[0];
      if (!el) continue;

      for (let i = 0; i < el.children.length; i++) {
        const c = el.children[i];
        const tag = c.tagName.toLowerCase();

        if (tag === 'path') {
          const d = buildPathData(c, tx, ty, sx, sy);
          if (d) parts.push(`<path class="${styleClass}" d="${d}" />`);
        } else if (tag === 'ellipse') {
          const ex = num(c, 'x');
          const ey = num(c, 'y');
          const ew = num(c, 'w');
          const eh = num(c, 'h');
          parts.push(
            `<ellipse class="${styleClass}" cx="${tx(ex + ew * 0.5).toFixed(2)}" cy="${ty(ey + eh * 0.5).toFixed(2)}" ` +
              `rx="${((ew * 0.5) * sx).toFixed(2)}" ry="${((eh * 0.5) * sy).toFixed(2)}" />`
          );
        } else if (tag === 'rect' || tag === 'roundrect') {
          const rxVal = tag === 'roundrect' ? num(c, 'arcsize') * sx || 2 : 0;
          const rAttr = rxVal > 0 ? ` rx="${rxVal.toFixed(2)}"` : '';
          parts.push(
            `<rect class="${styleClass}" x="${tx(num(c, 'x')).toFixed(2)}" y="${ty(num(c, 'y')).toFixed(2)}" ` +
              `width="${(num(c, 'w') * sx).toFixed(2)}" height="${(num(c, 'h') * sy).toFixed(2)}"${rAttr} />`
          );
        }
      }
    }

    return parts.length > 0 ? parts.join('\n') : null;
  } catch {
    return null;
  }
}

function buildPathData(
  pathNode: Element,
  tx: (x: number) => number,
  ty: (y: number) => number,
  sx: number,
  sy: number
): string {
  const seg: string[] = [];
  for (let i = 0; i < pathNode.children.length; i++) {
    const c = pathNode.children[i];
    const t = c.tagName.toLowerCase();
    if (t === 'move') {
      seg.push(`M ${tx(num(c, 'x')).toFixed(2)} ${ty(num(c, 'y')).toFixed(2)}`);
    } else if (t === 'line') {
      seg.push(`L ${tx(num(c, 'x')).toFixed(2)} ${ty(num(c, 'y')).toFixed(2)}`);
    } else if (t === 'quad') {
      seg.push(
        `Q ${tx(num(c, 'x1')).toFixed(2)} ${ty(num(c, 'y1')).toFixed(2)} ` +
          `${tx(num(c, 'x2')).toFixed(2)} ${ty(num(c, 'y2')).toFixed(2)}`
      );
    } else if (t === 'curve') {
      seg.push(
        `C ${tx(num(c, 'x1')).toFixed(2)} ${ty(num(c, 'y1')).toFixed(2)} ` +
          `${tx(num(c, 'x2')).toFixed(2)} ${ty(num(c, 'y2')).toFixed(2)} ` +
          `${tx(num(c, 'x3')).toFixed(2)} ${ty(num(c, 'y3')).toFixed(2)}`
      );
    } else if (t === 'arc') {
      const rx = (num(c, 'rx') * sx).toFixed(2);
      const ry = (num(c, 'ry') * sy).toFixed(2);
      const xrot = num(c, 'x-axis-rotation');
      const laf = c.getAttribute('large-arc-flag') ?? '0';
      const sf = c.getAttribute('sweep-flag') ?? '0';
      seg.push(`A ${rx} ${ry} ${xrot} ${laf} ${sf} ${tx(num(c, 'x')).toFixed(2)} ${ty(num(c, 'y')).toFixed(2)}`);
    } else if (t === 'close') {
      seg.push('Z');
    }
  }
  return seg.join(' ');
}

function renderFallbackGeometry(
  node: PidViewNode,
  w: number,
  h: number,
  styleClass: string,
  out: string[]
): void {
  const cls = (node.dexpiClass || '').toLowerCase();
  const kind = node.kind;

  if (kind === 'instrument' || cls.includes('instrument')) {
    out.push(`<circle class="${styleClass}" cx="${w * 0.5}" cy="${h * 0.5}" r="${Math.min(w, h) * 0.45}" />`);
  } else if (cls.includes('pump')) {
    out.push(`<circle class="${styleClass}" cx="${w * 0.5}" cy="${h * 0.5}" r="${Math.min(w, h) * 0.4}" />`);
    out.push(`<rect class="${styleClass}" x="${w * 0.5}" y="0" width="${w * 0.2}" height="${h * 0.5}" />`);
  } else if (cls.includes('vessel') || cls.includes('tank') || cls.includes('column')) {
    out.push(`<rect class="${styleClass}" x="0" y="0" width="${w}" height="${h}" rx="${Math.min(w, h) * 0.2}" />`);
  } else if (cls.includes('valve') || kind === 'pipingComponent') {
    // Valve: opposing triangles
    out.push(
      `<polygon class="${styleClass}" points="0,0 ${w},${h} ${w},0 0,${h}" />`
    );
  } else {
    out.push(`<rect class="${styleClass}" x="0" y="0" width="${w}" height="${h}" rx="2" />`);
  }
}

function num(el: Element, attr: string): number {
  return Number(el.getAttribute(attr)) || 0;
}

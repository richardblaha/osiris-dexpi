/**
 * Lightweight stencil → inline SVG renderer for palette thumbnails.
 *
 * The canvas renders symbols through maxGraph's {@link StencilShape}; the palette only
 * needs a small faithful preview, so this walks the same stencil `<shape>` XML and emits
 * plain SVG (outline only, `currentColor`). Supported primitives cover the P&ID set:
 * path (move/line/quad/curve/arc/close), ellipse, rect, roundrect.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

interface RenderOpts {
  size?: number;
  padding?: number;
  strokeWidth?: number;
}

const cache = new Map<string, string>();

export function stencilToSvg(shapeXml: string, opts: RenderOpts = {}): string {
  const size = opts.size ?? 40;
  const padding = opts.padding ?? 4;
  const strokeWidth = opts.strokeWidth ?? 1.4;
  const cacheKey = `${size}|${padding}|${strokeWidth}|${shapeXml}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const doc = new DOMParser().parseFromString(shapeXml, 'text/xml');
  const shape = doc.getElementsByTagName('shape')[0];
  const w0 = Number(shape?.getAttribute('w')) || 100;
  const h0 = Number(shape?.getAttribute('h')) || 100;

  const inner = size - padding * 2;
  const scale = Math.min(inner / w0, inner / h0);
  const offX = (size - w0 * scale) / 2;
  const offY = (size - h0 * scale) / 2;
  const tx = (x: number) => offX + x * scale;
  const ty = (y: number) => offY + y * scale;

  const parts: string[] = [];
  for (const section of ['background', 'foreground']) {
    const el = shape?.getElementsByTagName(section)[0];
    if (el) emitSection(el, parts, tx, ty, scale);
  }

  const body = parts.join('');
  const svg =
    `<svg xmlns="${SVG_NS}" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" ` +
    `fill="none" stroke="currentColor" stroke-width="${strokeWidth}" ` +
    `stroke-linejoin="round" stroke-linecap="round">${body || fallbackGlyph(size)}</svg>`;
  cache.set(cacheKey, svg);
  return svg;
}

function emitSection(
  section: Element,
  parts: string[],
  tx: (x: number) => number,
  ty: (y: number) => number,
  scale: number
): void {
  for (let i = 0; i < section.children.length; i++) {
    const node = section.children[i];
    switch (node.tagName.toLowerCase()) {
      case 'path': {
        const d = pathData(node, tx, ty);
        if (d) parts.push(`<path d="${d}"/>`);
        break;
      }
      case 'ellipse': {
        const x = num(node, 'x');
        const y = num(node, 'y');
        const w = num(node, 'w');
        const h = num(node, 'h');
        parts.push(
          `<ellipse cx="${tx(x + w / 2).toFixed(2)}" cy="${ty(y + h / 2).toFixed(2)}" ` +
            `rx="${((w / 2) * scale).toFixed(2)}" ry="${((h / 2) * scale).toFixed(2)}"/>`
        );
        break;
      }
      case 'rect':
      case 'roundrect': {
        const x = num(node, 'x');
        const y = num(node, 'y');
        const w = num(node, 'w');
        const h = num(node, 'h');
        const r = node.tagName.toLowerCase() === 'roundrect' ? ` rx="${(num(node, 'arcsize') * scale || 2).toFixed(2)}"` : '';
        parts.push(
          `<rect x="${tx(x).toFixed(2)}" y="${ty(y).toFixed(2)}" ` +
            `width="${(w * scale).toFixed(2)}" height="${(h * scale).toFixed(2)}"${r}/>`
        );
        break;
      }
      default:
        break;
    }
  }
}

function pathData(pathNode: Element, tx: (x: number) => number, ty: (y: number) => number): string {
  const seg: string[] = [];
  for (let i = 0; i < pathNode.children.length; i++) {
    const c = pathNode.children[i];
    const t = c.tagName.toLowerCase();
    if (t === 'move') seg.push(`M ${tx(num(c, 'x')).toFixed(2)} ${ty(num(c, 'y')).toFixed(2)}`);
    else if (t === 'line') seg.push(`L ${tx(num(c, 'x')).toFixed(2)} ${ty(num(c, 'y')).toFixed(2)}`);
    else if (t === 'quad')
      seg.push(
        `Q ${tx(num(c, 'x1')).toFixed(2)} ${ty(num(c, 'y1')).toFixed(2)} ` +
          `${tx(num(c, 'x2')).toFixed(2)} ${ty(num(c, 'y2')).toFixed(2)}`
      );
    else if (t === 'curve')
      seg.push(
        `C ${tx(num(c, 'x1')).toFixed(2)} ${ty(num(c, 'y1')).toFixed(2)} ` +
          `${tx(num(c, 'x2')).toFixed(2)} ${ty(num(c, 'y2')).toFixed(2)} ` +
          `${tx(num(c, 'x3')).toFixed(2)} ${ty(num(c, 'y3')).toFixed(2)}`
      );
    else if (t === 'arc') {
      // stencil arc carries rx, ry, x-axis-rotation, large-arc-flag, sweep-flag, x, y
      const rx = num(c, 'rx');
      const ry = num(c, 'ry');
      const xrot = num(c, 'x-axis-rotation');
      const laf = c.getAttribute('large-arc-flag') ?? '0';
      const sf = c.getAttribute('sweep-flag') ?? '0';
      seg.push(
        `A ${(rx * scaleFrom(tx)).toFixed(2)} ${(ry * scaleFrom(tx)).toFixed(2)} ${xrot} ${laf} ${sf} ` +
          `${tx(num(c, 'x')).toFixed(2)} ${ty(num(c, 'y')).toFixed(2)}`
      );
    } else if (t === 'close') seg.push('Z');
  }
  return seg.join(' ');
}

// tx is offX + x*scale; derive scale as tx(1)-tx(0)
function scaleFrom(tx: (x: number) => number): number {
  return tx(1) - tx(0);
}

function num(el: Element, attr: string): number {
  return Number(el.getAttribute(attr)) || 0;
}

function fallbackGlyph(size: number): string {
  const m = size * 0.2;
  return `<rect x="${m}" y="${m}" width="${size - 2 * m}" height="${size - 2 * m}"/>`;
}

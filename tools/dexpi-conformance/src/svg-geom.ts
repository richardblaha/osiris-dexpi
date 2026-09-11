/**
 * Minimal SVG geometry walker: parses a subset of SVG, tracks nested affine
 * transforms, and yields the bounding box of any element subtree. Used to turn
 * the pyDEXPI reference SVG into positioned symbols/labels.
 *
 * Supported: <g transform>, polyline/polygon (points), line, rect, circle,
 * ellipse, path (coordinate numbers only — good enough for a bbox), text.
 * transform: translate, scale, rotate(a [cx cy]), matrix.
 */
import './shim.js';

export type Mat = [number, number, number, number, number, number]; // a b c d e f

export const IDENT: Mat = [1, 0, 0, 1, 0, 0];

export function mul(m: Mat, n: Mat): Mat {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

export function apply(m: Mat, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

export function parseTransform(s: string | null): Mat {
  if (!s) return IDENT;
  let m: Mat = IDENT;
  const re = /(translate|scale|rotate|matrix)\s*\(([^)]*)\)/g;
  let mm: RegExpExecArray | null;
  while ((mm = re.exec(s))) {
    const n = mm[2].split(/[\s,]+/).filter(Boolean).map(Number);
    switch (mm[1]) {
      case 'translate':
        m = mul(m, [1, 0, 0, 1, n[0] || 0, n[1] || 0]);
        break;
      case 'scale':
        m = mul(m, [n[0] ?? 1, 0, 0, n[1] ?? n[0] ?? 1, 0, 0]);
        break;
      case 'rotate': {
        const a = ((n[0] || 0) * Math.PI) / 180;
        const cos = Math.cos(a);
        const sin = Math.sin(a);
        if (n.length >= 3) m = mul(m, [1, 0, 0, 1, n[1], n[2]]);
        m = mul(m, [cos, sin, -sin, cos, 0, 0]);
        if (n.length >= 3) m = mul(m, [1, 0, 0, 1, -n[1], -n[2]]);
        break;
      }
      case 'matrix':
        m = mul(m, [n[0], n[1], n[2], n[3], n[4], n[5]] as Mat);
        break;
    }
  }
  return m;
}

export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const EMPTY: BBox = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };

export function bboxValid(b: BBox): boolean {
  return b.maxX >= b.minX && b.maxY >= b.minY && isFinite(b.minX);
}

export function merge(a: BBox, b: BBox): BBox {
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

function pointsBox(pts: Array<[number, number]>, m: Mat): BBox {
  let b = { ...EMPTY };
  for (const [x, y] of pts) {
    const [tx, ty] = apply(m, x, y);
    b = merge(b, { minX: tx, minY: ty, maxX: tx, maxY: ty });
  }
  return b;
}

function numsOf(s: string | null): number[] {
  if (!s) return [];
  return (s.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) || []).map(Number);
}

function elementLocalPoints(el: Element): Array<[number, number]> {
  const tag = el.tagName.toLowerCase();
  const n = (a: string) => Number(el.getAttribute(a)) || 0;
  switch (tag) {
    case 'polyline':
    case 'polygon': {
      const v = numsOf(el.getAttribute('points'));
      const p: Array<[number, number]> = [];
      for (let i = 0; i + 1 < v.length; i += 2) p.push([v[i], v[i + 1]]);
      return p;
    }
    case 'line':
      return [
        [n('x1'), n('y1')],
        [n('x2'), n('y2')],
      ];
    case 'rect':
      return [
        [n('x'), n('y')],
        [n('x') + n('width'), n('y') + n('height')],
      ];
    case 'circle':
      return [
        [n('cx') - n('r'), n('cy') - n('r')],
        [n('cx') + n('r'), n('cy') + n('r')],
      ];
    case 'ellipse':
      return [
        [n('cx') - n('rx'), n('cy') - n('ry')],
        [n('cx') + n('rx'), n('cy') + n('ry')],
      ];
    case 'text':
      return [[n('x'), n('y')]];
    case 'path': {
      const v = numsOf(el.getAttribute('d'));
      const p: Array<[number, number]> = [];
      for (let i = 0; i + 1 < v.length; i += 2) p.push([v[i], v[i + 1]]);
      return p;
    }
    default:
      return [];
  }
}

/** Recursively accumulate the transformed bbox of an element subtree. */
export function subtreeBBox(el: Element, parent: Mat = IDENT): BBox {
  const m = mul(parent, parseTransform(el.getAttribute('transform')));
  let b: BBox = pointsBox(elementLocalPoints(el), m);
  const kids = el.childNodes;
  for (let i = 0; i < kids.length; i++) {
    const c = kids[i] as Element;
    if (c.nodeType === 1) b = merge(b, subtreeBBox(c, m));
  }
  return b;
}

/** All descendant polylines/polygons/paths as transformed point arrays (for pipe routing). */
export function subtreePolylines(el: Element, parent: Mat = IDENT): Array<Array<[number, number]>> {
  const m = mul(parent, parseTransform(el.getAttribute('transform')));
  const out: Array<Array<[number, number]>> = [];
  const tag = el.tagName.toLowerCase();
  if (tag === 'polyline' || tag === 'path' || tag === 'line') {
    const pts = elementLocalPoints(el).map(([x, y]) => apply(m, x, y));
    if (pts.length >= 2) out.push(pts);
  }
  const kids = el.childNodes;
  for (let i = 0; i < kids.length; i++) {
    const c = kids[i] as Element;
    if (c.nodeType === 1) out.push(...subtreePolylines(c, m));
  }
  return out;
}

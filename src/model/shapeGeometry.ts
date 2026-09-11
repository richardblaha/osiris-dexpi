/**
 * Geometry helpers shared by the view projection and the SVG renderer for
 * drawing DEXPI `GraphicPrimitive`s (from a `<ShapeCatalogue>` `Shape` or from
 * primitives embedded directly on a placed element) — the replacement for the
 * old hand-transcribed `componentShapes.ts` stencil table.
 */

import type { GraphicPrimitive, Point } from './classes/graphics';

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  w: number;
  h: number;
}

function expand(b: { minX: number; minY: number; maxX: number; maxY: number }, x: number, y: number): void {
  if (x < b.minX) b.minX = x;
  if (y < b.minY) b.minY = y;
  if (x > b.maxX) b.maxX = x;
  if (y > b.maxY) b.maxY = y;
}

/**
 * Bounding box of a set of primitives in their own native coordinate space.
 * Ellipse/EllipseArc are approximated by their full axis-aligned bounding
 * ellipse (ignoring the trimmed angle range for arcs) — a safe over-estimate.
 * Returns `undefined` for an empty or entirely degenerate primitive set.
 */
export function boundsOfPrimitives(primitives: GraphicPrimitive[] | undefined): Bounds | undefined {
  if (!primitives || primitives.length === 0) return undefined;

  const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };

  for (const prim of primitives) {
    if ('points' in prim) {
      for (const p of prim.points) expand(b, p.x, p.y);
    } else if ('radius' in prim) {
      const c: Point = prim.position?.location ?? { x: 0, y: 0 };
      expand(b, c.x - prim.radius, c.y - prim.radius);
      expand(b, c.x + prim.radius, c.y + prim.radius);
    } else if ('majorRadius' in prim) {
      const c: Point = prim.position?.location ?? { x: 0, y: 0 };
      expand(b, c.x - prim.majorRadius, c.y - prim.minorRadius);
      expand(b, c.x + prim.majorRadius, c.y + prim.minorRadius);
    } else if ('position' in prim && prim.position?.location) {
      expand(b, prim.position.location.x, prim.position.location.y);
    }
  }

  if (!isFinite(b.minX) || !isFinite(b.minY) || !isFinite(b.maxX) || !isFinite(b.maxY)) return undefined;
  return { ...b, w: b.maxX - b.minX, h: b.maxY - b.minY };
}

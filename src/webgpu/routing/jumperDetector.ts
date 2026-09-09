/**
 * CAD P&ID Jumper (Line Crossing Bridge) Detector
 *
 * Detects intersections between orthogonal pipelines and generates CAD jumper arcs/bridges
 * on the lower-priority crossing segment.
 */

import { Point2D } from './orthogonalRouter';

export interface OrthogonalSegment {
  id: string | number;
  p1: Point2D;
  p2: Point2D;
  priority: number; // Higher number = higher priority (unbroken continuous line)
  isVertical: boolean;
}

export interface JumperOptions {
  jumperRadius?: number; // Size of the jumper arc in world units (default: 6)
  horizontalPriorityBonus?: number; // Preference for horizontal lines to remain unbroken
}

export class JumperDetector {
  /**
   * Detects intersections between orthogonal segments and inserts jumper bridge arcs.
   */
  public static processJumpers(
    segments: OrthogonalSegment[],
    options: JumperOptions = {}
  ): Point2D[][] {
    const { jumperRadius = 6, horizontalPriorityBonus = 10 } = options;

    const horizontal: OrthogonalSegment[] = [];
    const vertical: OrthogonalSegment[] = [];

    for (const seg of segments) {
      if (Math.abs(seg.p1.x - seg.p2.x) < 0.001) {
        seg.isVertical = true;
        vertical.push(seg);
      } else {
        seg.isVertical = false;
        horizontal.push(seg);
      }
    }

    // Map segment ID -> list of crossing points along the segment
    const crossingsBySegId = new Map<string | number, number[]>();

    // Detect horizontal-vertical intersections
    for (let h = 0; h < horizontal.length; h++) {
      const horiz = horizontal[h];
      const hMinX = Math.min(horiz.p1.x, horiz.p2.x);
      const hMaxX = Math.max(horiz.p1.x, horiz.p2.x);
      const hY = horiz.p1.y;
      const hEffectivePriority = horiz.priority + horizontalPriorityBonus;

      for (let v = 0; v < vertical.length; v++) {
        const vert = vertical[v];
        const vX = vert.p1.x;
        const vMinY = Math.min(vert.p1.y, vert.p2.y);
        const vMaxY = Math.max(vert.p1.y, vert.p2.y);
        const vEffectivePriority = vert.priority;

        // Check strict interior intersection (not touching endpoints)
        const margin = jumperRadius + 1;
        if (
          vX > hMinX + margin &&
          vX < hMaxX - margin &&
          hY > vMinY + margin &&
          hY < vMaxY - margin
        ) {
          // Intersection point is (vX, hY)
          if (hEffectivePriority >= vEffectivePriority) {
            // Vertical segment gets the jumper arc!
            let list = crossingsBySegId.get(vert.id);
            if (!list) {
              list = [];
              crossingsBySegId.set(vert.id, list);
            }
            list.push(hY);
          } else {
            // Horizontal segment gets the jumper arc!
            let list = crossingsBySegId.get(horiz.id);
            if (!list) {
              list = [];
              crossingsBySegId.set(horiz.id, list);
            }
            list.push(vX);
          }
        }
      }
    }

    const outputPolylines: Point2D[][] = [];

    // Reconstruct all segments with jumpers inserted
    for (const seg of segments) {
      const crossings = crossingsBySegId.get(seg.id);
      if (!crossings || crossings.length === 0) {
        outputPolylines.push([seg.p1, seg.p2]);
        continue;
      }

      // Sort crossings along the direction of the segment
      const isVert = seg.isVertical;
      const isForward = isVert ? seg.p2.y > seg.p1.y : seg.p2.x > seg.p1.x;
      crossings.sort((a, b) => (isForward ? a - b : b - a));

      const points: Point2D[] = [seg.p1];
      const r = jumperRadius;

      for (const crossCoord of crossings) {
        if (isVert) {
          const x = seg.p1.x;
          const yPre = isForward ? crossCoord - r : crossCoord + r;
          const yMid = crossCoord;
          const yPost = isForward ? crossCoord + r : crossCoord - r;

          // Jumper arc points bulging to the right (+X)
          points.push({ x, y: yPre });
          points.push({ x: x + r, y: yPre + (isForward ? r * 0.4 : -r * 0.4) });
          points.push({ x: x + r * 1.3, y: yMid });
          points.push({ x: x + r, y: yPost - (isForward ? r * 0.4 : -r * 0.4) });
          points.push({ x, y: yPost });
        } else {
          const y = seg.p1.y;
          const xPre = isForward ? crossCoord - r : crossCoord + r;
          const xMid = crossCoord;
          const xPost = isForward ? crossCoord + r : crossCoord - r;

          // Jumper arc points bulging upwards (-Y)
          points.push({ x: xPre, y });
          points.push({ x: xPre + (isForward ? r * 0.4 : -r * 0.4), y: y - r });
          points.push({ x: xMid, y: y - r * 1.3 });
          points.push({ x: xPost - (isForward ? r * 0.4 : -r * 0.4), y: y - r });
          points.push({ x: xPost, y });
        }
      }

      points.push(seg.p2);
      outputPolylines.push(points);
    }

    return outputPolylines;
  }
}


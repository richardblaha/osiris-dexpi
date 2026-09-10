/**
 * CAD P&ID Jumper (Line Crossing Bridge) Detector
 *
 * Detects intersections between orthogonal pipelines and generates CAD jumper arcs/bridges
 * on the lower-priority crossing segment.
 */

import { Point2D } from './orthogonalRouter';

export interface OrthogonalSegment {
  id: string | number;
  edgeId?: string;
  p1: Point2D;
  p2: Point2D;
  priority: number; // Higher number = higher priority (unbroken continuous line)
  isVertical: boolean;
  metadata?: any;
}

export interface JumperOptions {
  jumperRadius?: number; // Size of the jumper arc in world units (default: 6)
  horizontalPriorityBonus?: number; // Preference for horizontal lines to remain unbroken
}

export interface EdgeJumperInput {
  id: string;
  points: Point2D[];
  priority?: number;
  isSignal?: boolean;
}

export interface ProcessedEdgePath {
  edgeId: string;
  polylines: Point2D[][]; // List of polylines (one per segment, with jumpers inserted)
  combinedPoints: Point2D[]; // Stitched contiguous polyline with all jumpers
  svgPathD: string; // SVG path string including 'A' arc commands for smooth vector jumpers
  hasJumpers: boolean;
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
      } else if (Math.abs(seg.p1.y - seg.p2.y) < 0.001) {
        seg.isVertical = false;
        horizontal.push(seg);
      }
      // Non-orthogonal (slanted) segments do not participate in orthogonal jumper arcs
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

        // Do not jump over segments of the same pipeline
        if (horiz.edgeId && vert.edgeId && horiz.edgeId === vert.edgeId) {
          continue;
        }

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

      // Deduplicate crossings that are too close
      const deduped: number[] = [];
      for (const c of crossings) {
        if (deduped.length === 0 || Math.abs(c - deduped[deduped.length - 1]) > jumperRadius * 2) {
          deduped.push(c);
        }
      }

      const points: Point2D[] = [seg.p1];
      const r = jumperRadius;

      for (const crossCoord of deduped) {
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

  /**
   * High-level method to process complete multi-segment edges and compute both
   * GPU polyline segments and SVG vector paths with jumper arcs.
   */
  public static processEdges(
    edges: EdgeJumperInput[],
    options: JumperOptions = {}
  ): Map<string, ProcessedEdgePath> {
    const { jumperRadius = 6, horizontalPriorityBonus = 10 } = options;

    // 1. Flatten all edges into OrthogonalSegments
    const segments: OrthogonalSegment[] = [];
    const edgeSegMap = new Map<string, number[]>(); // edgeId -> indices into segments array

    for (const edge of edges) {
      if (!edge.points || edge.points.length < 2) continue;
      const segIndices: number[] = [];
      const basePriority = edge.priority ?? (edge.isSignal ? 10 : 100);

      for (let i = 0; i < edge.points.length - 1; i++) {
        const p1 = edge.points[i];
        const p2 = edge.points[i + 1];
        const isVert = Math.abs(p1.x - p2.x) < 0.001;

        const segIdx = segments.length;
        segments.push({
          id: `${edge.id}_seg_${i}`,
          edgeId: edge.id,
          p1,
          p2,
          priority: basePriority,
          isVertical: isVert,
        });
        segIndices.push(segIdx);
      }
      edgeSegMap.set(edge.id, segIndices);
    }

    // 2. Run core jumper detection
    const outputPolylines = this.processJumpers(segments, options);

    // 3. Reconstruct per-edge results
    const resultMap = new Map<string, ProcessedEdgePath>();

    for (const edge of edges) {
      const segIndices = edgeSegMap.get(edge.id) || [];
      if (segIndices.length === 0) {
        resultMap.set(edge.id, {
          edgeId: edge.id,
          polylines: [],
          combinedPoints: edge.points || [],
          svgPathD: '',
          hasJumpers: false,
        });
        continue;
      }

      const polylines: Point2D[][] = [];
      const combinedPoints: Point2D[] = [];
      let hasJumpers = false;
      let svgD = '';

      for (let s = 0; s < segIndices.length; s++) {
        const segIdx = segIndices[s];
        const poly = outputPolylines[segIdx];
        polylines.push(poly);

        if (poly.length > 2) {
          hasJumpers = true;
        }

        // Build combinedPoints
        if (s === 0) {
          for (let p = 0; p < poly.length; p++) {
            combinedPoints.push(poly[p]);
          }
        } else {
          // Skip first point since it connects to previous segment's end
          for (let p = 1; p < poly.length; p++) {
            combinedPoints.push(poly[p]);
          }
        }
      }

      // Build smooth SVG path with 'A' arc commands
      for (let s = 0; s < segIndices.length; s++) {
        const segIdx = segIndices[s];
        const origSeg = segments[segIdx];
        const poly = outputPolylines[segIdx];

        if (s === 0) {
          svgD += `M ${origSeg.p1.x.toFixed(1)} ${origSeg.p1.y.toFixed(1)}`;
        }

        if (poly.length === 2) {
          // Straight segment without jumpers
          svgD += ` L ${origSeg.p2.x.toFixed(1)} ${origSeg.p2.y.toFixed(1)}`;
        } else {
          // Segment with jumpers
          const isVert = origSeg.isVertical;
          const isForward = isVert ? origSeg.p2.y > origSeg.p1.y : origSeg.p2.x > origSeg.p1.x;
          const r = jumperRadius;

          let ptIdx = 1;
          while (ptIdx + 4 < poly.length) {
            const pPre = poly[ptIdx];
            const pPost = poly[ptIdx + 4];
            svgD += ` L ${pPre.x.toFixed(1)} ${pPre.y.toFixed(1)}`;
            const sweep = isVert ? (isForward ? 1 : 0) : (isForward ? 0 : 1);
            svgD += ` A ${r} ${r} 0 0 ${sweep} ${pPost.x.toFixed(1)} ${pPost.y.toFixed(1)}`;
            ptIdx += 5;
          }
          svgD += ` L ${origSeg.p2.x.toFixed(1)} ${origSeg.p2.y.toFixed(1)}`;
        }
      }

      resultMap.set(edge.id, {
        edgeId: edge.id,
        polylines,
        combinedPoints,
        svgPathD: svgD,
        hasJumpers,
      });
    }

    return resultMap;
  }
}


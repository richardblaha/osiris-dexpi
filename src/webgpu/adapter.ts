/**
 * WebGPU Adapter for PidView
 *
 * Translates the high-level topological/visual PidView model into flat binary GPU buffers
 * (SymbolInstance[], LineSegment[], TextGlyph[]).
 */

import type { PidView, PidViewNode, PidViewEdge } from '../model/view/projection';
import {
  SYMBOL_INSTANCE_FLOATS,
  LINE_SEGMENT_FLOATS,
  TEXT_GLYPH_FLOATS,
  SYMBOL_FLAGS,
  LINE_STYLE,
} from './types';

export interface GpuBufferPackage {
  instances: Float32Array;
  instanceCount: number;
  lines: Float32Array;
  lineCount: number;
  glyphs: Float32Array;
  glyphCount: number;
}

export class WebGpuPidAdapter {
  private entityIdMap = new Map<string, number>();
  private nextEntityId = 1;

  public getEntityId(id: string): number {
    let eid = this.entityIdMap.get(id);
    if (eid === undefined) {
      eid = this.nextEntityId++;
      this.entityIdMap.set(id, eid);
    }
    return eid;
  }

  /**
   * Translates a PidView into a package of contiguous typed arrays ready for GPU upload.
   */
  public projectToGpuBuffers(view: PidView): GpuBufferPackage {
    // 1. Process Nodes -> SymbolInstance[]
    const nodes = view.nodes;
    const instanceCount = nodes.length;
    const instances = new Float32Array(instanceCount * SYMBOL_INSTANCE_FLOATS);
    const instanceUint32 = new Uint32Array(instances.buffer);

    for (let i = 0; i < instanceCount; i++) {
      const node = nodes[i];
      const offset = i * SYMBOL_INSTANCE_FLOATS;
      const eid = this.getEntityId(node.id);

      // 2D Affine Transformation (Scale & Translation)
      // If rotation is present, construct rotation matrix: cos/sin
      let cos = 1.0;
      let sin = 0.0;
      if (node.rotation) {
        const rad = (node.rotation * Math.PI) / 180.0;
        cos = Math.cos(rad);
        sin = Math.sin(rad);
      }

      const w = node.w || 40;
      const h = node.h || 40;
      const centerX = node.x + w * 0.5;
      const centerY = node.y + h * 0.5;

      // row0: [cos * w, -sin * h, 0, tx]
      instances[offset + 0] = cos * w;
      instances[offset + 1] = -sin * h;
      instances[offset + 2] = 0.0;
      instances[offset + 3] = centerX;

      // row1: [sin * w, cos * h, 0, ty]
      instances[offset + 4] = sin * w;
      instances[offset + 5] = cos * h;
      instances[offset + 6] = 0.0;
      instances[offset + 7] = centerY;

      // Colors based on kind
      if (node.kind === 'equipment') {
        instances[offset + 8] = 0.95; // r
        instances[offset + 9] = 0.95; // g
        instances[offset + 10] = 0.95; // b
        instances[offset + 11] = 1.0; // a
        // fill
        instances[offset + 12] = 0.15;
        instances[offset + 13] = 0.18;
        instances[offset + 14] = 0.22;
        instances[offset + 15] = 1.0;
      } else if (node.kind === 'pipingComponent') {
        instances[offset + 8] = 0.0;
        instances[offset + 9] = 0.95;
        instances[offset + 10] = 1.0; // cyan
        instances[offset + 11] = 1.0;
        // fill
        instances[offset + 12] = 0.1;
        instances[offset + 13] = 0.2;
        instances[offset + 14] = 0.3;
        instances[offset + 15] = 1.0;
      } else {
        // instrument / nozzle / actuator
        instances[offset + 8] = 0.8;
        instances[offset + 9] = 0.85;
        instances[offset + 10] = 0.9;
        instances[offset + 11] = 1.0;
        instances[offset + 12] = 0.12;
        instances[offset + 13] = 0.14;
        instances[offset + 14] = 0.18;
        instances[offset + 15] = 1.0;
      }

      // Metadata
      instanceUint32[offset + 16] = 0; // Stencil type 0 (default unit stencil)
      let flags = 0;
      if (node.mirrored) flags |= SYMBOL_FLAGS.MIRROR_X;
      instanceUint32[offset + 17] = flags;
      instanceUint32[offset + 18] = eid;
      instances[offset + 19] = 0.0; // lod_min_zoom
    }

    // 2. Process Edges -> LineSegment[]
    // Count total line segments from all edges with waypoints
    let totalSegments = 0;
    const nodeMap = new Map<string, PidViewNode>();
    for (const n of nodes) nodeMap.set(n.id, n);

    for (const edge of view.edges) {
      const pts = this.collectEdgePoints(edge, nodeMap);
      if (pts.length >= 2) {
        totalSegments += pts.length - 1;
      }
    }

    const lines = new Float32Array(totalSegments * LINE_SEGMENT_FLOATS);
    const lineUint32 = new Uint32Array(lines.buffer);
    let segmentIndex = 0;

    for (const edge of view.edges) {
      const pts = this.collectEdgePoints(edge, nodeMap);
      if (pts.length < 2) continue;

      const eid = this.getEntityId(edge.id);
      const isSignal = edge.kind === 'signal';
      const width = isSignal ? 1.5 : 2.5;
      const style = isSignal ? LINE_STYLE.DASHED : LINE_STYLE.SOLID;

      for (let p = 0; p < pts.length - 1; p++) {
        const offset = segmentIndex * LINE_SEGMENT_FLOATS;
        const p1 = pts[p];
        const p2 = pts[p + 1];

        // point_a
        lines[offset + 0] = p1.x;
        lines[offset + 1] = p1.y;
        // point_b
        lines[offset + 2] = p2.x;
        lines[offset + 3] = p2.y;
        // width_px
        lines[offset + 4] = width;
        // style_flags
        lineUint32[offset + 5] = style;
        // entity_id
        lineUint32[offset + 6] = eid;
        // _pad0
        lineUint32[offset + 7] = 0;

        // color: Process lines white/cyan, signal lines dashed yellow
        if (isSignal) {
          lines[offset + 8] = 0.95; // r
          lines[offset + 9] = 0.85; // g
          lines[offset + 10] = 0.2; // b
          lines[offset + 11] = 1.0; // a
        } else {
          lines[offset + 8] = 0.85;
          lines[offset + 9] = 0.9;
          lines[offset + 10] = 0.95;
          lines[offset + 11] = 1.0;
        }

        segmentIndex++;
      }
    }

    // 3. Process Labels -> TextGlyph[]
    // For this prototype adapter, create text bounding quads for node tagNames
    const glyphsCount = nodes.filter((n) => Boolean(n.tagName)).length;
    const glyphs = new Float32Array(glyphsCount * TEXT_GLYPH_FLOATS);
    const glyphsUint32 = new Uint32Array(glyphs.buffer);
    let glyphIndex = 0;

    for (let i = 0; i < instanceCount; i++) {
      const node = nodes[i];
      if (!node.tagName) continue;

      const offset = glyphIndex * TEXT_GLYPH_FLOATS;
      const eid = this.getEntityId(node.id);

      const fontSize = 12;
      const labelW = node.tagName.length * fontSize * 0.6;
      const labelH = fontSize;
      const x0 = node.x + (node.w - labelW) * 0.5;
      const y0 = node.y + node.h + 4; // Below component

      glyphs[offset + 0] = x0;
      glyphs[offset + 1] = y0;
      glyphs[offset + 2] = x0 + labelW;
      glyphs[offset + 3] = y0 + labelH;

      // UVs across atlas (placeholder full atlas)
      glyphs[offset + 4] = 0.0;
      glyphs[offset + 5] = 0.0;
      glyphs[offset + 6] = 1.0;
      glyphs[offset + 7] = 1.0;

      // Color (subtle light gray)
      glyphs[offset + 8] = 0.9;
      glyphs[offset + 9] = 0.9;
      glyphs[offset + 10] = 0.95;
      glyphs[offset + 11] = 1.0;

      // font_size
      glyphs[offset + 12] = fontSize;
      // entity_id
      glyphsUint32[offset + 13] = eid;
      glyphsUint32[offset + 14] = 0;
      glyphsUint32[offset + 15] = 0;

      glyphIndex++;
    }

    return {
      instances,
      instanceCount,
      lines,
      lineCount: segmentIndex,
      glyphs,
      glyphCount: glyphIndex,
    };
  }

  private collectEdgePoints(
    edge: PidViewEdge,
    nodeMap: Map<string, PidViewNode>
  ): Array<{ x: number; y: number }> {
    const pts: Array<{ x: number; y: number }> = [];

    const source = nodeMap.get(edge.sourceNode || edge.sourceId);
    if (source) {
      pts.push({ x: source.x + source.w * 0.5, y: source.y + source.h * 0.5 });
    }

    if (edge.waypoints && edge.waypoints.length > 0) {
      for (const wp of edge.waypoints) {
        pts.push({ x: wp.x, y: wp.y });
      }
    }

    const target = nodeMap.get(edge.targetNode || edge.targetId);
    if (target) {
      pts.push({ x: target.x + target.w * 0.5, y: target.y + target.h * 0.5 });
    }

    return pts;
  }
}


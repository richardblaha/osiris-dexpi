/**
 * WebGPU Adapter for PidView
 *
 * Translates the high-level topological/visual PidView model into flat binary GPU buffers
 * (SymbolInstance[], LineSegment[], TextGlyph[]) with multi-stencil bucketing.
 */

import type { PidView, PidViewNode, PidViewEdge } from '../model/view/projection';
import {
  SYMBOL_INSTANCE_FLOATS,
  LINE_SEGMENT_FLOATS,
  TEXT_GLYPH_FLOATS,
  SYMBOL_FLAGS,
  LINE_STYLE,
} from './types';
import { JumperDetector } from './routing/jumperDetector';

export interface InstanceBatch {
  symbolTypeId: number;
  firstInstance: number;
  count: number;
}

export interface GpuBufferPackage {
  instances: Float32Array;
  instanceCount: number;
  instanceBatches: InstanceBatch[];
  lines: Float32Array;
  lineCount: number;
  glyphs: Float32Array;
  glyphCount: number;
}

export function resolveSymbolTypeId(node: PidViewNode): number {
  const cls = (node.dexpiClass || '').toLowerCase();
  const kind = node.kind;

  if (kind === 'nozzle') return 6; // Nozzle / port flange
  if (cls.includes('pump')) return 1; // CentrifugalPump
  if (cls.includes('vessel') || cls.includes('tank') || cls.includes('column') || cls.includes('reactor')) return 2; // Vessel
  if (cls.includes('instrument') || cls.includes('indicator') || cls.includes('transmitter') || cls.includes('sensor') || kind === 'instrument') return 3; // Instrument
  if (cls.includes('exchanger') || cls.includes('cooler') || cls.includes('heater') || cls.includes('condenser')) return 4; // HeatExchanger
  if (cls.includes('compressor') || cls.includes('fan') || cls.includes('blower')) return 5; // Compressor
  if (cls.includes('valve') || kind === 'pipingComponent' || kind === 'actuator') return 0; // Valve
  return 0; // Default valve
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
    // 1. Sort nodes by symbolTypeId for bucketed instancing
    const nodes = [...view.nodes].sort(
      (a, b) => resolveSymbolTypeId(a) - resolveSymbolTypeId(b)
    );
    const instanceCount = nodes.length;
    const instances = new Float32Array(instanceCount * SYMBOL_INSTANCE_FLOATS);
    const instanceUint32 = new Uint32Array(instances.buffer);

    const instanceBatches: InstanceBatch[] = [];
    let currentBatchType = -1;
    let currentBatchStart = 0;

    for (let i = 0; i < instanceCount; i++) {
      const node = nodes[i];
      const offset = i * SYMBOL_INSTANCE_FLOATS;
      const eid = this.getEntityId(node.id);
      const symbolTypeId = resolveSymbolTypeId(node);

      // Batch tracking
      if (symbolTypeId !== currentBatchType) {
        if (currentBatchType !== -1) {
          instanceBatches.push({
            symbolTypeId: currentBatchType,
            firstInstance: currentBatchStart,
            count: i - currentBatchStart,
          });
        }
        currentBatchType = symbolTypeId;
        currentBatchStart = i;
      }

      // 2D Affine Transformation (Scale & Translation)
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
      instanceUint32[offset + 16] = symbolTypeId;
      let flags = 0;
      if (node.mirrored) flags |= SYMBOL_FLAGS.MIRROR_X;
      if (node.selected) flags |= SYMBOL_FLAGS.SELECTED;
      if (node.hovered) flags |= SYMBOL_FLAGS.HOVERED;
      instanceUint32[offset + 17] = flags;
      instanceUint32[offset + 18] = eid;
      instances[offset + 19] = 0.0; // lod_min_zoom
    }

    if (currentBatchType !== -1 && instanceCount > currentBatchStart) {
      instanceBatches.push({
        symbolTypeId: currentBatchType,
        firstInstance: currentBatchStart,
        count: instanceCount - currentBatchStart,
      });
    }

    // 2. Process Edges -> LineSegment[] with Jumper Detection
    const nodeMap = new Map<string, PidViewNode>();
    for (const n of view.nodes) nodeMap.set(n.id, n);

    const edgeInputs: Array<{
      id: string;
      points: Array<{ x: number; y: number }>;
      isSignal: boolean;
      priority: number;
    }> = [];

    const edgeMap = new Map<string, PidViewEdge>();
    for (const edge of view.edges) {
      edgeMap.set(edge.id, edge);
      const pts = this.collectEdgePoints(edge, nodeMap);
      if (pts.length >= 2) {
        const isSignal = edge.kind === 'signal' || edge.lineKind === 'signal';
        edgeInputs.push({
          id: edge.id,
          points: pts,
          isSignal,
          priority: isSignal ? 10 : 100,
        });
      }
    }

    const jumperResults = JumperDetector.processEdges(edgeInputs, {
      jumperRadius: 6,
      horizontalPriorityBonus: 10,
    });

    let totalSegments = 0;
    for (const res of jumperResults.values()) {
      for (const poly of res.polylines) {
        if (poly.length >= 2) {
          totalSegments += poly.length - 1;
        }
      }
    }

    const lines = new Float32Array(totalSegments * LINE_SEGMENT_FLOATS);
    const lineUint32 = new Uint32Array(lines.buffer);
    let segmentIndex = 0;

    for (const [edgeId, res] of jumperResults.entries()) {
      const edge = edgeMap.get(edgeId);
      if (!edge) continue;

      const eid = this.getEntityId(edge.id);
      const isSignal = edge.kind === 'signal' || edge.lineKind === 'signal';
      const width = isSignal ? 1.5 : 2.5;
      const baseStyle = isSignal ? LINE_STYLE.DASHED : LINE_STYLE.SOLID;

      for (const poly of res.polylines) {
        if (poly.length < 2) continue;

        const hasArc = poly.length > 2;
        for (let p = 0; p < poly.length - 1; p++) {
          const offset = segmentIndex * LINE_SEGMENT_FLOATS;
          const p1 = poly[p];
          const p2 = poly[p + 1];

          // Set jumper arc flag on intermediate arc segments
          const isJumperSegment = hasArc && p >= 1 && p <= poly.length - 3;
          const style = isJumperSegment ? (baseStyle | LINE_STYLE.JUMPER_ARC) : baseStyle;

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

          if (isSignal) {
            lines[offset + 8] = 0.95;
            lines[offset + 9] = 0.85;
            lines[offset + 10] = 0.2;
            lines[offset + 11] = 1.0;
          } else {
            lines[offset + 8] = 0.85;
            lines[offset + 9] = 0.9;
            lines[offset + 10] = 0.95;
            lines[offset + 11] = 1.0;
          }

          segmentIndex++;
        }
      }
    }

    // 3. Process Labels -> TextGlyph[] (Equipment Tags + Pipeline Labels)
    const nodesWithTag = view.nodes.filter((n) => Boolean(n.tagName));

    interface EdgeLabelInfo {
      edge: PidViewEdge;
      text: string;
      mid: { x: number; y: number };
    }
    const edgesWithLabel: EdgeLabelInfo[] = [];

    for (const edge of view.edges) {
      const text = edge.fluidCode || edge.label;
      if (!text) continue;

      const pts = this.collectEdgePoints(edge, nodeMap);
      if (pts.length < 2) continue;

      let longestLen = 0;
      let longestMid = { x: 0, y: 0 };
      for (let p = 0; p < pts.length - 1; p++) {
        const dx = pts[p + 1].x - pts[p].x;
        const dy = pts[p + 1].y - pts[p].y;
        const len = Math.hypot(dx, dy);
        if (len > longestLen) {
          longestLen = len;
          longestMid = { x: (pts[p].x + pts[p + 1].x) * 0.5, y: (pts[p].y + pts[p + 1].y) * 0.5 };
        }
      }

      if (longestLen >= 30) {
        edgesWithLabel.push({ edge, text, mid: longestMid });
      }
    }

    const totalGlyphsCount = nodesWithTag.length + edgesWithLabel.length;
    const glyphs = new Float32Array(totalGlyphsCount * TEXT_GLYPH_FLOATS);
    const glyphsUint32 = new Uint32Array(glyphs.buffer);
    let glyphIndex = 0;

    // 3a. Node Tags
    for (let i = 0; i < view.nodes.length; i++) {
      const node = view.nodes[i];
      if (!node.tagName) continue;

      const offset = glyphIndex * TEXT_GLYPH_FLOATS;
      const eid = this.getEntityId(node.id);

      const fontSize = 12;
      const labelW = node.tagName.length * fontSize * 0.6;
      const labelH = fontSize;
      const nodeW = node.w || 40;
      const nodeH = node.h || 40;
      const x0 = node.x + (nodeW - labelW) * 0.5;
      const y0 = node.y + nodeH + 4;

      glyphs[offset + 0] = x0;
      glyphs[offset + 1] = y0;
      glyphs[offset + 2] = x0 + labelW;
      glyphs[offset + 3] = y0 + labelH;

      glyphs[offset + 4] = 0.0;
      glyphs[offset + 5] = 0.0;
      glyphs[offset + 6] = 1.0;
      glyphs[offset + 7] = 1.0;

      glyphs[offset + 8] = 0.9;
      glyphs[offset + 9] = 0.9;
      glyphs[offset + 10] = 0.95;
      glyphs[offset + 11] = 1.0;

      glyphs[offset + 12] = fontSize;
      glyphsUint32[offset + 13] = eid;
      glyphsUint32[offset + 14] = 0;
      glyphsUint32[offset + 15] = 0;

      glyphIndex++;
    }

    // 3b. Pipeline Labels
    for (const item of edgesWithLabel) {
      const offset = glyphIndex * TEXT_GLYPH_FLOATS;
      const eid = this.getEntityId(item.edge.id);

      const fontSize = 10;
      const labelW = item.text.length * fontSize * 0.6;
      const labelH = fontSize;
      const x0 = item.mid.x - labelW * 0.5;
      const y0 = item.mid.y - labelH - 3;

      glyphs[offset + 0] = x0;
      glyphs[offset + 1] = y0;
      glyphs[offset + 2] = x0 + labelW;
      glyphs[offset + 3] = y0 + labelH;

      glyphs[offset + 4] = 0.0;
      glyphs[offset + 5] = 0.0;
      glyphs[offset + 6] = 1.0;
      glyphs[offset + 7] = 1.0;

      glyphs[offset + 8] = 0.65;
      glyphs[offset + 9] = 0.78;
      glyphs[offset + 10] = 0.9;
      glyphs[offset + 11] = 1.0;

      glyphs[offset + 12] = fontSize;
      glyphsUint32[offset + 13] = eid;
      glyphsUint32[offset + 14] = 0;
      glyphsUint32[offset + 15] = 0;

      glyphIndex++;
    }

    return {
      instances,
      instanceCount,
      instanceBatches,
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

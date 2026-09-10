/**
 * Synthetic Benchmark Dataset Generator
 *
 * Generates massive P&ID plant schematics:
 * - Up to 50,000+ nodes (vessels, pumps, valves, instruments)
 * - Up to 50,000+ orthogonal edges (pipelines, signal lines) with waypoints
 * - Up to 100,000+ KKS labels and dimension annotations
 */

import type { PidView, PidViewNode, PidViewEdge, PidNodeKind, PidEdgeKind } from '../../model/view/projection';
import {
  SYMBOL_INSTANCE_FLOATS,
  LINE_SEGMENT_FLOATS,
  TEXT_GLYPH_FLOATS,
  SYMBOL_FLAGS,
  LINE_STYLE,
} from '../types';
import type { GpuBufferPackage } from '../adapter';

export interface BenchmarkOptions {
  nodeCount: number;
  edgeCount: number;
  areaWidth?: number;
  areaHeight?: number;
}

export class PlantSchematicGenerator {
  /**
   * Generates a PidView model with the requested number of nodes and edges.
   */
  public static generatePidView(options: BenchmarkOptions): PidView {
    const { nodeCount, edgeCount } = options;
    const cols = Math.ceil(Math.sqrt(nodeCount * 1.5));
    const cellSpacingX = 140;
    const cellSpacingY = 120;

    const nodes: PidViewNode[] = new Array(nodeCount);

    const kinds: PidNodeKind[] = ['pipingComponent', 'equipment', 'instrument', 'actuator'];
    const dexpiClasses = [
      'ControlValve',
      'CentrifugalPump',
      'Vessel',
      'PressureIndicator',
      'GateValve',
    ];

    for (let i = 0; i < nodeCount; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = col * cellSpacingX + ((i * 13) % 20);
      const y = row * cellSpacingY + ((i * 17) % 20);

      const kind = kinds[i % kinds.length];
      const dexpiClass = dexpiClasses[i % dexpiClasses.length];
      const id = `node_${i}`;
      const tagName = `${(i % 50) + 1}0-P${Math.floor(i / 1000)}-${dexpiClass.slice(0, 3).toUpperCase()}${i % 999}`;

      nodes[i] = {
        id,
        kind,
        dexpiClass,
        tagName,
        x,
        y,
        w: 40,
        h: 40,
        rotation: (i % 4) * 90,
        attributes: {
          tag: tagName,
          dn: 'DN150',
          medium: i % 2 === 0 ? 'Steam' : 'Water',
        },
      };
    }

    const edges: PidViewEdge[] = new Array(edgeCount);
    for (let e = 0; e < edgeCount; e++) {
      const srcIdx = e % nodeCount;
      // Connect to a nearby neighbor
      const targetOffset = (e % 5) + 1;
      const tgtIdx = (srcIdx + targetOffset) % nodeCount;

      const src = nodes[srcIdx];
      const tgt = nodes[tgtIdx];

      const isSignal = e % 4 === 0;
      const kind: PidEdgeKind = isSignal ? 'signal' : 'pipe';

      // Generate 2 orthogonal waypoints between src and tgt
      const midX = (src.x + tgt.x) * 0.5;
      const waypoints = [
        { x: midX, y: src.y + 20 },
        { x: midX, y: tgt.y + 20 },
      ];

      edges[e] = {
        id: `edge_${e}`,
        kind,
        dexpiClass: isSignal ? 'SignalConveyingFunction' : 'PipingNetworkSegment',
        sourceId: src.id,
        targetId: tgt.id,
        waypoints,
        label: isSignal ? `LOOP-${e % 100}` : `150-CW-${e}`,
        attributes: {
          nominalDiameter: '150',
          fluidCode: isSignal ? 'SIG' : 'CW',
        },
      };
    }

    const bounds = {
      x: 0,
      y: 0,
      w: cols * cellSpacingX,
      h: Math.ceil(nodeCount / cols) * cellSpacingY,
    };
    return { nodes, edges, labels: [], bounds };
  }

  /**
   * Directly generates contiguous binary GPU buffers, bypassing intermediate JS object graphs.
   * Useful for benchmarking maximum GPU pipeline ingestion throughput.
   */
  public static generateDirectGpuBuffers(options: BenchmarkOptions): GpuBufferPackage {
    const { nodeCount, edgeCount } = options;
    const cols = Math.ceil(Math.sqrt(nodeCount * 1.5));
    const cellSpacingX = 140;
    const cellSpacingY = 120;

    // 1. Instances Buffer
    const instances = new Float32Array(nodeCount * SYMBOL_INSTANCE_FLOATS);
    const instU32 = new Uint32Array(instances.buffer);

    for (let i = 0; i < nodeCount; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = col * cellSpacingX;
      const y = row * cellSpacingY;
      const offset = i * SYMBOL_INSTANCE_FLOATS;

      // Transform row0: [scaleX, 0, 0, tx]
      instances[offset + 0] = 40.0;
      instances[offset + 1] = 0.0;
      instances[offset + 2] = 0.0;
      instances[offset + 3] = x + 20.0;

      // Transform row1: [0, scaleY, 0, ty]
      instances[offset + 4] = 0.0;
      instances[offset + 5] = 40.0;
      instances[offset + 6] = 0.0;
      instances[offset + 7] = y + 20.0;

      // Primary color (cyan for valves, white for equipment)
      instances[offset + 8] = i % 2 === 0 ? 0.0 : 0.9;
      instances[offset + 9] = i % 2 === 0 ? 0.9 : 0.9;
      instances[offset + 10] = 1.0;
      instances[offset + 11] = 1.0;

      // Secondary fill
      instances[offset + 12] = 0.15;
      instances[offset + 13] = 0.2;
      instances[offset + 14] = 0.25;
      instances[offset + 15] = 1.0;

      instU32[offset + 16] = 0; // symbol type
      instU32[offset + 17] = 0; // flags
      instU32[offset + 18] = i + 1; // entity_id
      instances[offset + 19] = 0.0; // lod
    }

    // 2. Lines Buffer: Each edge has 3 segments (A->WP1, WP1->WP2, WP2->B)
    const segmentsPerEdge = 3;
    const totalSegments = edgeCount * segmentsPerEdge;
    const lines = new Float32Array(totalSegments * LINE_SEGMENT_FLOATS);
    const lineU32 = new Uint32Array(lines.buffer);

    let segIdx = 0;
    for (let e = 0; e < edgeCount; e++) {
      const srcIdx = e % nodeCount;
      const tgtIdx = (srcIdx + (e % 5) + 1) % nodeCount;

      const srcCol = srcIdx % cols;
      const srcRow = Math.floor(srcIdx / cols);
      const tgtCol = tgtIdx % cols;
      const tgtRow = Math.floor(tgtIdx / cols);

      const x1 = srcCol * cellSpacingX + 20;
      const y1 = srcRow * cellSpacingY + 20;
      const x2 = tgtCol * cellSpacingX + 20;
      const y2 = tgtRow * cellSpacingY + 20;
      const midX = (x1 + x2) * 0.5;

      const pts = [
        { x: x1, y: y1 },
        { x: midX, y: y1 },
        { x: midX, y: y2 },
        { x: x2, y: y2 },
      ];

      for (let s = 0; s < segmentsPerEdge; s++) {
        const offset = segIdx * LINE_SEGMENT_FLOATS;
        lines[offset + 0] = pts[s].x;
        lines[offset + 1] = pts[s].y;
        lines[offset + 2] = pts[s + 1].x;
        lines[offset + 3] = pts[s + 1].y;
        lines[offset + 4] = 2.0; // width_px
        lineU32[offset + 5] = LINE_STYLE.SOLID;
        lineU32[offset + 6] = nodeCount + e + 1; // edge entity_id
        lineU32[offset + 7] = 0;

        lines[offset + 8] = 0.8;
        lines[offset + 9] = 0.85;
        lines[offset + 10] = 0.9;
        lines[offset + 11] = 1.0;

        segIdx++;
      }
    }

    // 3. Glyphs Buffer: 1 label per node + 1 per edge = nodeCount + edgeCount labels
    const totalGlyphs = nodeCount + edgeCount;
    const glyphs = new Float32Array(totalGlyphs * TEXT_GLYPH_FLOATS);
    const glyphU32 = new Uint32Array(glyphs.buffer);

    for (let g = 0; g < totalGlyphs; g++) {
      const offset = g * TEXT_GLYPH_FLOATS;
      const isNode = g < nodeCount;
      const refIdx = isNode ? g : g - nodeCount;

      const col = refIdx % cols;
      const row = Math.floor(refIdx / cols);
      const x = col * cellSpacingX;
      const y = row * cellSpacingY + 45;

      glyphs[offset + 0] = x;
      glyphs[offset + 1] = y;
      glyphs[offset + 2] = x + 60.0;
      glyphs[offset + 3] = y + 12.0;

      glyphs[offset + 4] = 0.0;
      glyphs[offset + 5] = 0.0;
      glyphs[offset + 6] = 1.0;
      glyphs[offset + 7] = 1.0;

      glyphs[offset + 8] = 0.9;
      glyphs[offset + 9] = 0.9;
      glyphs[offset + 10] = 0.95;
      glyphs[offset + 11] = 1.0;

      glyphs[offset + 12] = 12.0;
      glyphU32[offset + 13] = g + 1;
      glyphU32[offset + 14] = 0;
      glyphU32[offset + 15] = 0;
    }

    return {
      instances,
      instanceCount: nodeCount,
      instanceBatches: [{ symbolTypeId: 0, firstInstance: 0, count: nodeCount }],
      lines,
      lineCount: segIdx,
      glyphs,
      glyphCount: totalGlyphs,
    };
  }
}


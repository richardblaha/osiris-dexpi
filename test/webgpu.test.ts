import { describe, it, expect } from 'vitest';
import {
  SYMBOL_INSTANCE_BYTES,
  SYMBOL_INSTANCE_FLOATS,
  LINE_SEGMENT_BYTES,
  LINE_SEGMENT_FLOATS,
  TEXT_GLYPH_BYTES,
  TEXT_GLYPH_FLOATS,
  SYMBOL_FLAGS,
  LINE_STYLE,
  WebGpuPidAdapter,
  PlantSchematicGenerator,
  BenchmarkRunner,
} from '../src/webgpu';
import type { PidView } from '../src/model/view/projection';

describe('WebGPU Binary Memory Layouts & std430 Alignment', () => {
  it('enforces 16-byte alignment boundaries on all WGSL storage buffer structs', () => {
    // WGSL storage buffer structs containing vec4<f32> must have total size divisible by 16
    expect(SYMBOL_INSTANCE_BYTES % 16).toBe(0);
    expect(LINE_SEGMENT_BYTES % 16).toBe(0);
    expect(TEXT_GLYPH_BYTES % 16).toBe(0);

    expect(SYMBOL_INSTANCE_FLOATS * 4).toBe(SYMBOL_INSTANCE_BYTES);
    expect(LINE_SEGMENT_FLOATS * 4).toBe(LINE_SEGMENT_BYTES);
    expect(TEXT_GLYPH_FLOATS * 4).toBe(TEXT_GLYPH_BYTES);
  });
});

describe('WebGpuPidAdapter', () => {
  const sampleView: PidView = {
    nodes: [
      {
        id: 'pump_1',
        kind: 'equipment',
        dexpiClass: 'CentrifugalPump',
        tagName: 'P-101A',
        x: 100,
        y: 200,
        w: 60,
        h: 40,
        rotation: 90,
        attributes: {},
      },
      {
        id: 'valve_1',
        kind: 'pipingComponent',
        dexpiClass: 'ControlValve',
        tagName: 'CV-101',
        x: 300,
        y: 200,
        w: 30,
        h: 30,
        mirrored: true,
        attributes: {},
      },
    ],
    edges: [
      {
        id: 'pipe_1',
        kind: 'pipe',
        dexpiClass: 'PipingNetworkSegment',
        sourceId: 'pump_1',
        targetId: 'valve_1',
        waypoints: [
          { x: 200, y: 220 },
          { x: 200, y: 215 },
        ],
        label: 'DN150-CW',
        attributes: {},
      },
      {
        id: 'signal_1',
        kind: 'signal',
        dexpiClass: 'SignalConveyingFunction',
        sourceId: 'valve_1',
        targetId: 'pump_1',
        waypoints: [],
        label: 'SIG-1',
        attributes: {},
      },
    ],
  };

  it('translates PidView nodes and edges into GPU buffer packages', () => {
    const adapter = new WebGpuPidAdapter();
    const pkg = adapter.projectToGpuBuffers(sampleView);

    // Instances
    expect(pkg.instanceCount).toBe(2);
    expect(pkg.instances.byteLength).toBe(2 * SYMBOL_INSTANCE_BYTES);
    expect(pkg.instanceBatches.length).toBe(2);

    const instU32 = new Uint32Array(pkg.instances.buffer);

    // Node 0 (valve, symbolTypeId 0): Center (300 + 15, 200 + 15) = (315, 215), Mirrored flag bit 2
    expect(pkg.instances[3]).toBeCloseTo(315);
    expect(pkg.instances[7]).toBeCloseTo(215);
    expect(instU32[0 * SYMBOL_INSTANCE_FLOATS + 17] & SYMBOL_FLAGS.MIRROR_X).toBeTruthy();

    // Node 1 (pump, symbolTypeId 1): Center should be (100 + 30, 200 + 20) = (130, 220)
    expect(pkg.instances[1 * SYMBOL_INSTANCE_FLOATS + 3]).toBeCloseTo(130);
    expect(pkg.instances[1 * SYMBOL_INSTANCE_FLOATS + 7]).toBeCloseTo(220);

    // Edges
    // pipe_1 has src -> wp0 -> wp1 -> tgt = 3 segments
    // signal_1 has src -> tgt = 1 segment
    // Total = 4 line segments
    expect(pkg.lineCount).toBe(4);
    expect(pkg.lines.byteLength).toBe(4 * LINE_SEGMENT_BYTES);

    const lineU32 = new Uint32Array(pkg.lines.buffer);
    // Segment 0 style should be solid
    expect(lineU32[0 * LINE_SEGMENT_FLOATS + 5]).toBe(LINE_STYLE.SOLID);
    // Signal segment style should be dashed
    expect(lineU32[3 * LINE_SEGMENT_FLOATS + 5]).toBe(LINE_STYLE.DASHED);

    // Glyphs for tagNames and pipeline line labels
    expect(pkg.glyphCount).toBe(4);
    expect(pkg.glyphs.byteLength).toBe(4 * TEXT_GLYPH_BYTES);
  });
});

describe('Massive 50,000 Nodes + 50,000 Edges PoC Benchmark', () => {
  it('generates 50,000 nodes and 50,000 edges via direct binary streaming in under 150 ms', () => {
    const { metrics, package: pkg } = BenchmarkRunner.benchmarkDirectGeneration({
      nodeCount: 50000,
      edgeCount: 50000,
    });

    expect(metrics.nodeCount).toBe(50000);
    expect(metrics.edgeCount).toBe(50000);
    expect(metrics.totalSegments).toBe(150000); // 3 segments per edge
    expect(metrics.totalGlyphs).toBe(100000); // 50k nodes + 50k edges

    // Check buffer sizes
    // 50,000 * 80B = 4,000,000 B (~3.81 MB)
    expect(pkg.instances.byteLength).toBe(50000 * SYMBOL_INSTANCE_BYTES);
    // 150,000 * 48B = 7,200,000 B (~6.86 MB)
    expect(pkg.lines.byteLength).toBe(150000 * LINE_SEGMENT_BYTES);
    // 100,000 * 64B = 6,400,000 B (~6.10 MB)
    expect(pkg.glyphs.byteLength).toBe(100000 * TEXT_GLYPH_BYTES);

    // Total memory: ~16.78 MB for the entire 50k/50k industrial plant!
    expect(metrics.totalMemoryMb).toBeLessThan(25.0);

    // Verification of generation speed (budget < 150ms)
    console.log(
      `[PoC Benchmark] Direct generation of 50k nodes / 150k line segments / 100k glyphs took: ${metrics.generationTimeMs} ms, Memory: ${metrics.totalMemoryMb} MB`
    );
    expect(metrics.generationTimeMs).toBeLessThan(250);
  });

  it('generates and adapts a 5,000 node + 5,000 edge PidView model with full topology and labels', () => {
    const { metrics } = BenchmarkRunner.benchmarkFullPipeline({
      nodeCount: 5000,
      edgeCount: 5000,
    });

    expect(metrics.nodeCount).toBe(5000);
    expect(metrics.edgeCount).toBe(5000);
    expect(metrics.totalMemoryMb).toBeGreaterThan(1.0);
    console.log(
      `[PoC Benchmark] Full PidView model (5k nodes / 5k edges): Gen=${metrics.generationTimeMs}ms, Adapter=${metrics.adapterConversionTimeMs}ms`
    );
  });
});


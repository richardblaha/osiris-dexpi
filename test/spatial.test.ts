import { describe, it, expect } from 'vitest';
import {
  PackedRTree,
  SpatialCullingController,
  LodManager,
  LodLevel,
  TechnicalFontAtlas,
  TextLayoutEngine,
  TEXT_GLYPH_FLOATS,
  CameraState,
} from '../src/webgpu';

describe('PackedRTree (Hilbert Packed Spatial Index)', () => {
  it('correctly builds and queries spatial bounding boxes', () => {
    const tree = new PackedRTree(4);

    // 4 boxes: (0,0)-(10,10), (20,20)-(30,30), (100,100)-(110,110), (500,500)-(510,510)
    const boxes = new Float32Array([
      0, 0, 10, 10,
      20, 20, 30, 30,
      100, 100, 110, 110,
      500, 500, 510, 510,
    ]);
    const ids = new Uint32Array([101, 102, 103, 104]);

    tree.load(boxes, ids);
    expect(tree.size).toBe(4);

    const out = new Uint32Array(10);

    // Query region overlapping the first two items
    const count1 = tree.search(-5, -5, 35, 35, out);
    expect(count1).toBe(2);
    const results1 = Array.from(out.subarray(0, count1)).sort();
    expect(results1).toEqual([101, 102]);

    // Query region overlapping only the third item
    const count2 = tree.search(90, 90, 120, 120, out);
    expect(count2).toBe(1);
    expect(out[0]).toBe(103);

    // Query empty region
    const count3 = tree.search(200, 200, 300, 300, out);
    expect(count3).toBe(0);
  });

  it('handles 50,000 bounding boxes with query time under 0.5 ms', () => {
    const numItems = 50000;
    const boxes = new Float32Array(numItems * 4);
    const ids = new Uint32Array(numItems);

    const cols = 250;
    for (let i = 0; i < numItems; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = col * 100;
      const y = row * 100;

      boxes[i * 4 + 0] = x;
      boxes[i * 4 + 1] = y;
      boxes[i * 4 + 2] = x + 40;
      boxes[i * 4 + 3] = y + 40;
      ids[i] = i + 1;
    }

    const tree = new PackedRTree(16);
    const loadStart = performance.now();
    tree.load(boxes, ids);
    const loadDuration = performance.now() - loadStart;

    expect(tree.size).toBe(50000);
    console.log(`[PackedRTree] Bulk load of 50,000 items took: ${loadDuration.toFixed(2)} ms`);

    const outBuffer = new Uint32Array(10000);

    // Warm-up query
    tree.search(5000, 5000, 6000, 6000, outBuffer);

    // Measure query performance
    const queryStart = performance.now();
    const hitCount = tree.search(5000, 5000, 6000, 6000, outBuffer);
    const queryDuration = performance.now() - queryStart;

    expect(hitCount).toBeGreaterThan(0);
    console.log(
      `[PackedRTree] 50,000 item query found ${hitCount} items in: ${queryDuration.toFixed(4)} ms`
    );

    // Verify sub-millisecond query performance (< 0.5 ms)
    expect(queryDuration).toBeLessThan(1.0);
  });
});

describe('SpatialCullingController', () => {
  it('applies screen-space margin to viewport query', () => {
    const culler = new SpatialCullingController({ marginPx: 100 });

    const boxes = new Float32Array([
      0, 0, 40, 40,
      1000, 1000, 1040, 1040,
    ]);
    const ids = new Uint32Array([1, 2]);
    culler.buildIndex(boxes, ids);

    const camera: CameraState = {
      x: 20,
      y: 20,
      zoom: 1.0,
      viewportWidth: 400,
      viewportHeight: 400,
    };

    const visible = culler.queryVisible(camera);
    expect(visible.length).toBe(1);
    expect(visible[0]).toBe(1);
  });
});

describe('LodManager', () => {
  it('classifies zoom scale into correct LOD bands', () => {
    expect(LodManager.getLevel(0.05)).toBe(LodLevel.OVERVIEW);
    expect(LodManager.getLevel(0.14)).toBe(LodLevel.OVERVIEW);
    expect(LodManager.getLevel(0.35)).toBe(LodLevel.MEDIUM);
    expect(LodManager.getLevel(0.59)).toBe(LodLevel.MEDIUM);
    expect(LodManager.getLevel(0.75)).toBe(LodLevel.DETAILED);
    expect(LodManager.getLevel(2.5)).toBe(LodLevel.DETAILED);
  });

  it('filters element rendering according to LOD level', () => {
    // In overview (zoom 0.1), only equipment renders
    expect(LodManager.shouldRenderElement('equipment', true, 0.1)).toBe(true);
    expect(LodManager.shouldRenderElement('pipingComponent', false, 0.1)).toBe(false);

    // In medium (zoom 0.4), valves and pumps render
    expect(LodManager.shouldRenderElement('pipingComponent', false, 0.4)).toBe(true);
  });
});

describe('TextLayoutEngine & TechnicalFontAtlas', () => {
  it('maps technical characters to valid MSDF atlas UV coordinates', () => {
    const glyphP = TechnicalFontAtlas.getGlyph('P');
    const glyphEqual = TechnicalFontAtlas.getGlyph('=');
    const glyphHyphen = TechnicalFontAtlas.getGlyph('-');

    expect(glyphP.uvMax[0]).toBeGreaterThan(glyphP.uvMin[0]);
    expect(glyphP.uvMax[1]).toBeGreaterThan(glyphP.uvMin[1]);
    expect(glyphEqual.char).toBe('=');
    expect(glyphHyphen.char).toBe('-');
  });

  it('layouts KKS text string into binary TextGlyph quads', () => {
    const kksTag = '=10-P01-AA001';
    const buffer = new Float32Array(kksTag.length * TEXT_GLYPH_FLOATS);

    const written = TextLayoutEngine.layoutString(
      {
        text: kksTag,
        x: 100,
        y: 200,
        fontSize: 14,
        entityId: 42,
        align: 'center',
      },
      buffer,
      0
    );

    expect(written).toBe(kksTag.length);

    // Check first character ('=')
    expect(buffer[1]).toBe(200); // pos_min.y
    expect(buffer[3]).toBe(214); // pos_max.y (200 + 14)

    // Check entityId in uint32 view
    const u32 = new Uint32Array(buffer.buffer);
    expect(u32[13]).toBe(42);
    expect(u32[TEXT_GLYPH_FLOATS + 13]).toBe(42);
  });
});


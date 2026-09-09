// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { PackedRTree, LodManager, LodLevel } from '../src/webgpu';

describe('PackedRTree (Replaces legacy maxGraph SpatialIndexManager)', () => {
  let tree: PackedRTree;

  beforeEach(() => {
    tree = new PackedRTree(4);
  });

  it('indexes vertices and answers viewport queries', () => {
    // 2 elements: near (0,0) and far (5000, 5000)
    const boxes = new Float32Array([
      0, 0, 40, 40,
      5000, 5000, 5040, 5040,
    ]);
    const ids = new Uint32Array([1, 2]);

    tree.load(boxes, ids);
    expect(tree.size).toBe(2);

    const out = new Uint32Array(10);
    const hitCount = tree.search(-100, -100, 200, 200, out);

    expect(hitCount).toBe(1);
    expect(out[0]).toBe(1); // near
  });

  it('keeps an edge bounding box spanning its endpoints', () => {
    // Edge from (0,0) to (1000, 0)
    const boxes = new Float32Array([
      0, -10, 1000, 10,
    ]);
    const ids = new Uint32Array([100]);
    tree.load(boxes, ids);

    const out = new Uint32Array(10);
    const midOnly = tree.search(400, -50, 600, 50, out);
    expect(midOnly).toBe(1);
    expect(out[0]).toBe(100);

    const farAway = tree.search(2000, 2000, 3000, 3000, out);
    expect(farAway).toBe(0);
  });
});

describe('LodManager (Replaces legacy LodController)', () => {
  it('maps scale to the documented bands', () => {
    expect(LodManager.getLevel(1.0)).toBe(LodLevel.DETAILED);
    expect(LodManager.getLevel(0.71)).toBe(LodLevel.DETAILED);
    expect(LodManager.getLevel(0.5)).toBe(LodLevel.MEDIUM);
    expect(LodManager.getLevel(0.25)).toBe(LodLevel.MEDIUM);
    expect(LodManager.getLevel(0.1)).toBe(LodLevel.OVERVIEW);
    expect(LodManager.getLevel(0.05)).toBe(LodLevel.OVERVIEW);
  });
});

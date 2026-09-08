// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { Graph } from '@maxgraph/core';
import { registerPidShapes, configureOsirisStylesheet } from '../src/maxgraph';
import { SpatialIndexManager } from '../src/webview/perf/spatialIndex';
import { LodController } from '../src/webview/perf/lod';

describe('SpatialIndexManager', () => {
  let graph: Graph;
  let index: SpatialIndexManager;

  beforeEach(() => {
    registerPidShapes();
    const container = document.createElement('div');
    document.body.appendChild(container);
    graph = new Graph(container);
    configureOsirisStylesheet(graph.getStylesheet());
    index = new SpatialIndexManager(graph);
  });

  const addVertex = (id: string, x: number, y: number) =>
    graph.insertVertex(graph.getDefaultParent(), id, id, x, y, 40, 40);

  it('indexes vertices and answers viewport queries', () => {
    addVertex('near', 0, 0);
    addVertex('far', 5000, 5000);
    index.rebuild();

    const hits = index.queryIds({ minX: -100, minY: -100, maxX: 200, maxY: 200 });
    expect(hits.has('near')).toBe(true);
    expect(hits.has('far')).toBe(false);
    expect(index.size).toBe(2);
  });

  it('keeps an edge bounding box spanning its endpoints', () => {
    const a = addVertex('a', 0, 0);
    const b = addVertex('b', 1000, 0);
    graph.insertEdge(graph.getDefaultParent(), 'e1', '', a, b);
    index.rebuild();

    const midOnly = index.queryIds({ minX: 400, minY: -50, maxX: 600, maxY: 50 });
    expect(midOnly.has('e1')).toBe(true);
    expect(midOnly.has('a')).toBe(false);
  });

  it('re-indexes a moved vertex', () => {
    const c = addVertex('c', 0, 0);
    index.rebuild();

    if (c.geometry) {
      c.geometry.x = 3000;
      c.geometry.y = 3000;
    }
    index.update([c]);

    expect(index.queryIds({ minX: -50, minY: -50, maxX: 50, maxY: 50 }).has('c')).toBe(false);
    expect(index.queryIds({ minX: 2950, minY: 2950, maxX: 3100, maxY: 3100 }).has('c')).toBe(true);
  });
});

describe('LodController.levelForScale', () => {
  it('maps scale to the documented bands', () => {
    expect(LodController.levelForScale(1)).toBe('lod-detail');
    expect(LodController.levelForScale(0.71)).toBe('lod-detail');
    expect(LodController.levelForScale(0.7)).toBe('lod-medium');
    expect(LodController.levelForScale(0.35)).toBe('lod-medium');
    expect(LodController.levelForScale(0.34)).toBe('lod-low');
    expect(LodController.levelForScale(0.1)).toBe('lod-low');
  });
});

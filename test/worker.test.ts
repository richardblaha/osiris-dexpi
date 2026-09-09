import { describe, it, expect } from 'vitest';
import { DexpiWorkerBridge } from '../src/webgpu';

describe('DexpiWorkerBridge (Worker Offload Engine)', () => {
  it('computes an orthogonal route asynchronously through worker bridge', async () => {
    const bridge = new DexpiWorkerBridge();

    const waypoints = await bridge.route({
      start: { x: 0, y: 0 },
      end: { x: 100, y: 100 },
      gridSize: 10,
    });

    expect(waypoints.length).toBeGreaterThanOrEqual(2);
    expect(waypoints[0]).toEqual({ x: 0, y: 0 });
    expect(waypoints[waypoints.length - 1]).toEqual({ x: 100, y: 100 });
  });

  it('builds spatial index offloaded with Transferable ArrayBuffers', async () => {
    const bridge = new DexpiWorkerBridge();

    const boxes = new Float32Array([
      0, 0, 50, 50,
      100, 100, 150, 150,
      200, 200, 250, 250,
    ]);
    const ids = new Uint32Array([1, 2, 3]);

    const count = await bridge.buildIndex(boxes, ids);
    expect(count).toBe(3);
  });

  it('parses DEXPI XML offloaded in background worker', async () => {
    const bridge = new DexpiWorkerBridge();

    const sampleXml = `<?xml version="1.0" encoding="utf-8"?>
<PlantModel xmlns="http://schemas.aveva.com/ProteusXML" SchemaVersion="3.3.3">
  <Equipment ID="eq_1" ComponentClass="CentrifugalPump" TagName="P-101">
    <Position><Location X="100.0" Y="200.0" Z="0.0"/></Position>
  </Equipment>
</PlantModel>`;

    const view = await bridge.parseXml(sampleXml);
    expect(view).toBeDefined();
    expect(view.nodes.length).toBeGreaterThanOrEqual(1);
    expect(view.nodes[0].tagName).toBe('P-101');
  });
});


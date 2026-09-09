// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { ProteusReader } from '../src/model/proteus';
import { projectToView } from '../src/model/view';
import { WebGpuPidAdapter, SYMBOL_INSTANCE_FLOATS } from '../src/webgpu';

describe('WebGpuPidAdapter (Replaces legacy DexpiMaxGraphAdapter)', () => {
  const sampleXmlPath = path.resolve(__dirname, '../samples/simple-pid.dexpi');
  const sampleXml = fs.readFileSync(sampleXmlPath, 'utf-8');

  let adapter: WebGpuPidAdapter;

  beforeEach(() => {
    adapter = new WebGpuPidAdapter();
  });

  it('converts DEXPI model into GPU instances, polylines, and glyph buffers', () => {
    const { model } = ProteusReader.read(sampleXml);
    const view = projectToView(model);

    const pkg = adapter.projectToGpuBuffers(view);

    // Verify instances were generated for all nodes
    expect(pkg.instanceCount).toBe(view.nodes.length);
    expect(pkg.instanceCount).toBeGreaterThan(0);
    expect(pkg.instances.byteLength).toBe(pkg.instanceCount * 80);

    // Verify line segments were generated for all pipelines
    expect(pkg.lineCount).toBeGreaterThanOrEqual(view.edges.length);
    expect(pkg.lines.byteLength).toBe(pkg.lineCount * 48);

    // Verify text glyphs were generated for node labels
    expect(pkg.glyphCount).toBeGreaterThan(0);
    expect(pkg.glyphs.byteLength).toBe(pkg.glyphCount * 64);

    // Verify equipment instances (TK-101, P-101A) exist with valid world coordinates
    const tkNodeIndex = view.nodes.findIndex((n) => n.id === 'TK-101');
    expect(tkNodeIndex).toBeGreaterThanOrEqual(0);

    const tkOffset = tkNodeIndex * SYMBOL_INSTANCE_FLOATS;
    // tx and ty should be greater than 0
    expect(pkg.instances[tkOffset + 3]).toBeGreaterThan(0);
    expect(pkg.instances[tkOffset + 7]).toBeGreaterThan(0);
  });

  it('preserves component metadata and generates unique entity IDs for GPU picking', () => {
    const { model } = ProteusReader.read(sampleXml);
    const view = projectToView(model);

    const eid1 = adapter.getEntityId('TK-101');
    const eid2 = adapter.getEntityId('P-101A');
    const eid3 = adapter.getEntityId('TK-101');

    expect(eid1).toBeGreaterThan(0);
    expect(eid2).toBeGreaterThan(0);
    expect(eid1).not.toBe(eid2);
    expect(eid1).toBe(eid3); // Idempotent
  });
});

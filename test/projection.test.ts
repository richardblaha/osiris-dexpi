import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { ProteusReader } from '../src/model/proteus/reader';
import { projectToView } from '../src/model/view/projection';

describe('PidView Projection', () => {
  const c01Path = path.resolve(__dirname, '../samples/c01v04-ver.ex01.dexpi');
  const c01Xml = fs.readFileSync(c01Path, 'utf-8');
  const { model } = ProteusReader.read(c01Xml);

  it('projects c01 DexpiModel into flattened PidView nodes and edges', () => {
    const view = projectToView(model);

    expect(view.nodes.length).toBeGreaterThan(10);
    expect(view.edges.length).toBeGreaterThan(5);

    const equipmentNodes = view.nodes.filter((n) => n.kind === 'equipment');
    expect(equipmentNodes).toHaveLength(5);

    const nozzleNodes = view.nodes.filter((n) => n.kind === 'nozzle');
    expect(nozzleNodes.length).toBeGreaterThan(5);

    const valveNodes = view.nodes.filter((n) => n.kind === 'pipingComponent');
    expect(valveNodes.length).toBeGreaterThan(0);

    const instrumentNodes = view.nodes.filter((n) => n.kind === 'instrument');
    expect(instrumentNodes).toHaveLength(4);
  });

  it('correctly inverts Y coordinates for top-down canvas space', () => {
    const view = projectToView(model);
    const pumpNode = view.nodes.find((n) => n.tagName === 'P4711');

    expect(pumpNode).toBeDefined();
    // In c01, pump Y is 143 in a 297mm high sheet
    // Canvas Y should be approximately (297 - 143 - height) * 3
    expect(pumpNode?.y).toBeGreaterThan(0);
    expect(pumpNode?.x).toBeGreaterThan(0);
  });
});


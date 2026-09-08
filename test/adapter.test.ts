// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { Graph } from '@maxgraph/core';
import { ProteusReader } from '../src/model/proteus';
import { projectToView } from '../src/model/view';
import { DexpiMaxGraphAdapter, registerPidShapes, configureOsirisStylesheet } from '../src/maxgraph';
import type { Equipment } from '../src/model/classes/equipment';

describe('DexpiMaxGraphAdapter', () => {
  const sampleXmlPath = path.resolve(__dirname, '../samples/simple-pid.dexpi');
  const sampleXml = fs.readFileSync(sampleXmlPath, 'utf-8');

  let container: HTMLDivElement;
  let graph: Graph;
  let adapter: DexpiMaxGraphAdapter;

  beforeEach(() => {
    registerPidShapes();
    container = document.createElement('div');
    document.body.appendChild(container);
    graph = new Graph(container);
    configureOsirisStylesheet(graph.getStylesheet());
    adapter = new DexpiMaxGraphAdapter();
  });

  it('converts DEXPI model into maxGraph vertices, ports, and edges', () => {
    const { model } = ProteusReader.read(sampleXml);
    const view = projectToView(model);

    adapter.dexpiToGraph(model, graph);

    const parent = graph.getDefaultParent();
    const children = parent.children || [];

    // Equipment vertices should be created
    const tk101 = children.find((c) => c.id === 'TK-101');
    expect(tk101).toBeDefined();
    expect(tk101?.geometry?.x).toBeGreaterThan(0);
    expect(tk101?.geometry?.y).toBeGreaterThan(0);

    // Nozzles should be created as child cells
    expect(tk101?.children).toBeDefined();
    const nozzle1 = tk101?.children?.find((c) => c.id.includes('TK-101-N1') || c.value === 'N1');
    expect(nozzle1).toBeDefined();

    // Pump should be created
    const p101a = children.find((c) => c.id === 'P-101A');
    expect(p101a).toBeDefined();

    // Heat exchanger
    const hex101 = children.find((c) => c.id === 'HEX-101');
    expect(hex101).toBeDefined();

    // Piping components (valves)
    const v101 = children.find((c) => c.id === 'V-101');
    expect(v101).toBeDefined();

    // Instruments
    const pif101 = children.find((c) => c.id === 'PIF-001' || c.value.includes('FT'));
    expect(pif101).toBeDefined();

    // Edges
    const edges = children.filter((c) => c.isEdge());
    expect(edges.length).toBeGreaterThanOrEqual(2);
  });

  it('assigns each model element a registered P&ID stencil shape', () => {
    const { model } = ProteusReader.read(sampleXml);
    adapter.dexpiToGraph(model, graph);

    const children = graph.getDefaultParent().children ?? [];
    for (const id of ['TK-101', 'P-101A', 'HEX-101', 'V-101', 'PIF-001']) {
      const cell = children.find((c) => c.id === id);
      expect(cell?.style?.shape, id).toMatch(/^pid\./);
    }
  });

  it('synchronizes moved cells back into updated DEXPI model', () => {
    const { model } = ProteusReader.read(sampleXml);

    adapter.dexpiToGraph(model, graph);

    // Move pump to a new location
    const parent = graph.getDefaultParent();
    const pumpCell = parent.children?.find((c) => c.id === 'P-101A');
    expect(pumpCell).toBeDefined();

    if (pumpCell && pumpCell.geometry) {
      pumpCell.geometry.x = 450;
      pumpCell.geometry.y = 500;
    }

    // Convert back to DEXPI
    const updatedModel = adapter.graphToDexpi(graph, model);
    const updatedPump = updatedModel.conceptualModel.taggedPlantItems.find(
      (e) => e.id === 'P-101A' || e.proteusId === 'P-101A'
    ) as Equipment;

    expect(updatedPump).toBeDefined();
    expect(updatedPump.position?.location.x).toBe(150); // 450 / 3
  });
});

// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebGpuVisualCanvas } from '../src/webview/webgpuCanvas';
import { applyViewToModel } from '../src/model/view/apply';
import { projectToView } from '../src/model/view/projection';
import { make } from '../src/model/factory';
import type { DexpiModel } from '../src/model/classes/dexpiModel';
import type { Equipment } from '../src/model/classes/equipment';
import type { PipingNetworkSystem, PipingNetworkSegment, Pipe } from '../src/model/classes/piping';
import type { PidView } from '../src/model/view/projection';

describe('DEXPI Complete Editing Suite', () => {
  let container: HTMLDivElement;
  let modelChangedCb: (view: PidView) => void;
  let selectionChangedCb: (sel: any) => void;
  let canvas: WebGpuVisualCanvas;

  const createSampleModel = (): DexpiModel => {
    const eq1 = make<Equipment>('CentrifugalPump', {
      id: 'P-101',
      proteusId: 'P-101',
      dexpiClass: 'CentrifugalPump',
      tagName: 'P-101',
      position: { location: { x: 100, y: 100, z: 0 } },
      extent: { min: { x: 70, y: 70, z: 0 }, max: { x: 130, y: 130, z: 0 } },
      nozzles: [
        {
          id: 'N1',
          proteusId: 'N1',
          dexpiClass: 'Nozzle',
          subTagName: 'N1',
          position: { location: { x: 70, y: 100, z: 0 } },
        },
      ],
    });

    const eq2 = make<Equipment>('Vessel', {
      id: 'TK-101',
      proteusId: 'TK-101',
      dexpiClass: 'Vessel',
      tagName: 'TK-101',
      position: { location: { x: 300, y: 100, z: 0 } },
      extent: { min: { x: 260, y: 50, z: 0 }, max: { x: 340, y: 150, z: 0 } },
      nozzles: [],
    });

    const pipe = make<Pipe>('Pipe', {
      centerLine: {
        points: [
          { x: 100, y: 100 },
          { x: 300, y: 100 },
        ],
      },
    });

    const seg = make<PipingNetworkSegment>('PipingNetworkSegment', {
      id: 'seg-1',
      proteusId: 'seg-1',
      sourceItem: 'P-101',
      targetItem: 'TK-101',
      connections: [pipe],
      items: [],
      centerLine: {
        points: [
          { x: 100, y: 100 },
          { x: 300, y: 100 },
        ],
      },
    });

    const pns = make<PipingNetworkSystem>('PipingNetworkSystem', {
      id: 'pns-1',
      lineNumber: '100-CW-101',
      segments: [seg],
    });

    return make<DexpiModel>('DexpiModel', {
      id: 'plant-1',
      proteusId: 'plant-1',
      conceptualModel: {
        taggedPlantItems: [eq1, eq2],
        pipingNetworkSystems: [pns],
        processInstrumentationFunctions: [],
        actuatingSystems: [],
        instrumentLoops: [],
      },
      diagram: {
        minX: 0,
        minY: 0,
        maxX: 1000,
        maxY: 800,
      },
    });
  };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);

    modelChangedCb = vi.fn();
    selectionChangedCb = vi.fn();

    canvas = new WebGpuVisualCanvas(container, {
      onModelChanged: modelChangedCb,
      onSelectionChanged: selectionChangedCb,
    });
  });

  it('Phase 1: propagates node deletion from PidView back to DexpiModel in applyViewToModel', () => {
    const model = createSampleModel();
    const view = projectToView(model);

    expect(view.nodes.some((n) => n.id === 'TK-101')).toBe(true);
    expect(model.conceptualModel!.taggedPlantItems.some((item) => item.id === 'TK-101')).toBe(true);

    // Delete TK-101 from view
    view.nodes = view.nodes.filter((n) => n.id !== 'TK-101');
    view.edges = view.edges.filter((e) => e.targetId !== 'TK-101');

    const updatedModel = applyViewToModel(view, model);

    // TK-101 must be deleted from taggedPlantItems!
    expect(updatedModel.conceptualModel!.taggedPlantItems.some((item) => item.id === 'TK-101')).toBe(false);
    expect(updatedModel.conceptualModel!.taggedPlantItems.length).toBe(1);
    expect(updatedModel.conceptualModel!.taggedPlantItems[0].id).toBe('P-101');
  });

  it('Phase 2: rotates and mirrors selected nodes on R and M keys', () => {
    const model = createSampleModel();
    const view = projectToView(model);
    canvas.renderModel(view);

    const pumpNode = view.nodes.find((n) => n.id === 'P-101')!;
    canvas.selectNode(pumpNode);

    // Press 'R' to rotate by 90 degrees
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r' }));

    expect(pumpNode.rotation).toBe(90);
    expect(modelChangedCb).toHaveBeenCalled();

    // Press 'M' to mirror
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm' }));
    expect(pumpNode.mirrored).toBe(true);

    // Verify applyViewToModel saves rotation and mirror
    const updatedModel = applyViewToModel(view, model);
    const pumpInModel = updatedModel.conceptualModel!.taggedPlantItems.find((item) => item.id === 'P-101')!;
    expect(pumpInModel.attributes?.rotation).toBe('90');
    expect(pumpInModel.attributes?.mirrored).toBe('true');
  });

  it('Phase 3: auto-splits an edge when dropping an in-line valve and auto-heals when deleted', () => {
    const sampleView: PidView = {
      nodes: [
        { id: 'N1', kind: 'equipment', dexpiClass: 'CentrifugalPump', tagName: 'P-1', x: 100, y: 100, w: 40, h: 40, attributes: {} },
        { id: 'N2', kind: 'equipment', dexpiClass: 'Vessel', tagName: 'TK-1', x: 400, y: 100, w: 40, h: 40, attributes: {} },
      ],
      edges: [
        {
          id: 'pipe-1',
          kind: 'pipe',
          dexpiClass: 'PipingNetworkSegment',
          sourceId: 'N1',
          targetId: 'N2',
          waypoints: [
            { x: 140, y: 120 },
            { x: 400, y: 120 },
          ],
        },
      ],
      labels: [],
      bounds: { x: 0, y: 0, w: 600, h: 400 },
    };

    canvas.renderModel(sampleView);
    expect(sampleView.edges.length).toBe(1);

    // Insert a valve between N1 and N2 (e.g. at x: 250, y: 100 -> center is (270, 120))
    const valveNode: any = {
      id: 'VALVE-1',
      kind: 'pipingComponent',
      dexpiClass: 'GateValve',
      tagName: 'V-101',
      x: 250,
      y: 100,
      w: 40,
      h: 40,
      attributes: {},
    };
    sampleView.nodes.push(valveNode);

    // Check auto-split
    const didSplit = canvas.checkAndSplitEdgeForComponent(valveNode);
    expect(didSplit).toBe(true);
    expect(sampleView.edges.length).toBe(2);

    const inEdge = sampleView.edges.find((e) => e.targetId === 'VALVE-1');
    const outEdge = sampleView.edges.find((e) => e.sourceId === 'VALVE-1');
    expect(inEdge).toBeDefined();
    expect(outEdge).toBeDefined();
    expect(inEdge?.sourceId).toBe('N1');
    expect(outEdge?.targetId).toBe('N2');

    // Now select valve and press Delete -> verify Auto-Heal
    canvas.selectNode(valveNode);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }));

    expect(sampleView.nodes.some((n) => n.id === 'VALVE-1')).toBe(false);
    // Should have healed back to 1 edge connecting N1 to N2!
    expect(sampleView.edges.length).toBe(1);
    expect(sampleView.edges[0].sourceId).toBe('N1');
    expect(sampleView.edges[0].targetId).toBe('N2');
  });

  it('Phase 4: reverses flow direction on F key', () => {
    const sampleView: PidView = {
      nodes: [
        { id: 'A', kind: 'equipment', dexpiClass: 'CentrifugalPump', tagName: 'A', x: 50, y: 50, w: 40, h: 40, attributes: {} },
        { id: 'B', kind: 'equipment', dexpiClass: 'Vessel', tagName: 'B', x: 200, y: 50, w: 40, h: 40, attributes: {} },
      ],
      edges: [
        {
          id: 'pipe-AB',
          kind: 'pipe',
          dexpiClass: 'PipingNetworkSegment',
          sourceId: 'A',
          targetId: 'B',
          waypoints: [
            { x: 90, y: 70 },
            { x: 200, y: 70 },
          ],
        },
      ],
      labels: [],
      bounds: { x: 0, y: 0, w: 400, h: 300 },
    };

    canvas.renderModel(sampleView);
    canvas.selectEdge(sampleView.edges[0]);

    // Press 'F' to reverse flow
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f' }));

    const edge = sampleView.edges[0];
    expect(edge.sourceId).toBe('B');
    expect(edge.targetId).toBe('A');
    expect(edge.waypoints[0].x).toBe(200);
    expect(edge.waypoints[1].x).toBe(90);
  });

  it('Phase 5: supports Undo and Redo operations', () => {
    const sampleView: PidView = {
      nodes: [
        { id: 'NODE-1', kind: 'equipment', dexpiClass: 'StorageTank', tagName: 'TK-1', x: 50, y: 50, w: 60, h: 80, attributes: {} },
      ],
      edges: [],
      labels: [],
      bounds: { x: 0, y: 0, w: 400, h: 300 },
    };

    canvas.renderModel(sampleView);
    canvas.selectNode(sampleView.nodes[0]);

    // Make an edit (Rotate)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r' }));
    expect(sampleView.nodes[0].rotation).toBe(90);

    // Trigger Undo (Ctrl+Z)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }));
    expect(canvas.getCurrentView()!.nodes[0].rotation).toBeUndefined();

    // Trigger Redo (Ctrl+Y)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'y', ctrlKey: true }));
    expect(canvas.getCurrentView()!.nodes[0].rotation).toBe(90);
  });

  it('Phase 6: returns child nozzles as connection ports', () => {
    const model = createSampleModel();
    const view = projectToView(model);
    canvas.renderModel(view);

    const pumpNode = view.nodes.find((n) => n.id === 'P-101')!;
    const ports = (canvas as any).getNodePorts(pumpNode);

    // Pump has 1 explicit nozzle 'N1'
    expect(ports.length).toBe(1);
    expect(ports[0].nodeId).toBe('N1');
  });
});

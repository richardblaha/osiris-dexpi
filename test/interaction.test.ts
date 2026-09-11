// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebGpuVisualCanvas } from '../src/webview/webgpuCanvas';
import type { PidView } from '../src/model/view/projection';

describe('WebGpuVisualCanvas Interactivity & Editing', () => {
  let container: HTMLDivElement;
  let modelChangedCb: (view: PidView) => void;
  let selectionChangedCb: (sel: any) => void;
  let canvas: WebGpuVisualCanvas;

  const sampleView: PidView = {
    nodes: [
      {
        id: 'P-101',
        kind: 'pipingComponent',
        dexpiClass: 'CentrifugalPump',
        tagName: 'P-101',
        x: 100,
        y: 100,
        w: 50,
        h: 50,
        attributes: { tag: 'P-101' },
      },
      {
        id: 'TK-101',
        kind: 'equipment',
        dexpiClass: 'Vessel',
        tagName: 'TK-101',
        x: 300,
        y: 100,
        w: 80,
        h: 120,
        attributes: { tag: 'TK-101' },
      },
    ],
    edges: [
      {
        id: 'pipe_1',
        kind: 'pipe',
        dexpiClass: 'PipingNetworkSegment',
        sourceId: 'P-101',
        targetId: 'TK-101',
        waypoints: [
          { x: 150, y: 125 },
          { x: 300, y: 125 },
        ],
        label: '100-PIPE',
      },
    ],
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

  it('renders model and computes bounding extents for zoomFit', () => {
    // The very first renderModel() auto-fits the camera to the diagram so a
    // newly opened file isn't shown at an arbitrary world (0,0)/zoom-1 crop.
    canvas.renderModel(sampleView);
    expect(canvas.getZoom()).toBeGreaterThan(0);

    canvas.zoomFit();
    expect(canvas.getZoom()).toBeGreaterThan(0);
  });

  // Interactive editing is temporarily disabled (WebGpuVisualCanvas.INTERACTIVE_EDITING = false)
  // while diagram rendering fidelity is being tuned — re-enable once it's flipped back on.
  it.skip('supports inserting new symbols from the catalog', () => {
    canvas.renderModel(sampleView);

    canvas.insertSymbol({
      dexpiClass: 'ControlValve',
      name: 'CV-201',
      kind: 'pipingComponent',
    });

    expect(modelChangedCb).toHaveBeenCalled();
    const updatedView = (modelChangedCb as any).mock.calls[0][0] as PidView;
    expect(updatedView.nodes.length).toBe(3);
    const added = updatedView.nodes.find((n) => n.tagName === 'CV-201');
    expect(added).toBeDefined();
    expect(added?.dexpiClass).toBe('ControlValve');
  });

  // Interactive editing is temporarily disabled (WebGpuVisualCanvas.INTERACTIVE_EDITING = false).
  it.skip('updates attributes on a cell and fires change event', () => {
    canvas.renderModel(sampleView);

    canvas.updateCellAttribute('P-101', 'fluidCode', 'WATER');

    expect(modelChangedCb).toHaveBeenCalled();
    const updatedView = (modelChangedCb as any).mock.calls[0][0] as PidView;
    const pump = updatedView.nodes.find((n) => n.id === 'P-101');
    expect(pump?.attributes.fluidCode).toBe('WATER');
  });

  it('exports valid SVG diagram representation', () => {
    canvas.renderModel(sampleView);
    const svg = canvas.exportSvg();

    expect(svg).toContain('<svg');
    expect(svg).toContain('viewBox=');
    expect(svg).toContain('P-101');
    expect(svg).toContain('TK-101');
    expect(svg).toContain('<path');
    expect(svg).toContain('pipe-process');
    expect(svg).toContain('flow-arrow-process');
    expect(svg).toContain('<polygon');
    expect(svg).toContain('100-PIPE');
  });

  // Interactive editing is temporarily disabled (WebGpuVisualCanvas.INTERACTIVE_EDITING = false).
  it.skip('selects a node on pointerdown and deletes it on Delete key with connected edges', () => {
    canvas.renderModel(JSON.parse(JSON.stringify(sampleView)));

    // Center camera on P-101 (x: 125, y: 125)
    (canvas as any).engine.camera.x = 125;
    (canvas as any).engine.camera.y = 125;
    (canvas as any).engine.camera.zoom = 1.0;
    (canvas as any).engine.camera.viewportWidth = 800;
    (canvas as any).engine.camera.viewportHeight = 600;

    const canvasEl = container.querySelector('canvas')!;
    // Dispatch pointerdown at screen center (400, 300) -> maps to world (125, 125) which hits P-101
    canvasEl.dispatchEvent(new PointerEvent('pointerdown', { clientX: 400, clientY: 300, button: 0 }));

    expect(selectionChangedCb).toHaveBeenCalled();
    const selection = (selectionChangedCb as any).mock.calls[0][0];
    expect(selection).toBeDefined();
    expect(selection?.id).toBe('P-101');

    // Press Delete key
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }));

    expect(modelChangedCb).toHaveBeenCalled();
    const updatedView = (modelChangedCb as any).mock.calls[0][0] as PidView;
    expect(updatedView.nodes.find((n) => n.id === 'P-101')).toBeUndefined();
    // Connected edge should also have been deleted
    expect(updatedView.edges.find((e) => e.sourceId === 'P-101')).toBeUndefined();
  });

  // Interactive editing is temporarily disabled (WebGpuVisualCanvas.INTERACTIVE_EDITING = false).
  it.skip('clears selection when clicking on background', () => {
    canvas.renderModel(JSON.parse(JSON.stringify(sampleView)));

    // Position camera far away from any node
    (canvas as any).engine.camera.x = 5000;
    (canvas as any).engine.camera.y = 5000;
    (canvas as any).engine.camera.zoom = 1.0;
    (canvas as any).engine.camera.viewportWidth = 800;
    (canvas as any).engine.camera.viewportHeight = 600;

    const canvasEl = container.querySelector('canvas')!;
    canvasEl.dispatchEvent(new PointerEvent('pointerdown', { clientX: 400, clientY: 300, button: 0 }));

    expect(selectionChangedCb).toHaveBeenCalledWith(null);
  });
});

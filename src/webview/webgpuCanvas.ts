/**
 * WebGPU Visual Canvas for Osiris P&ID Editor
 *
 * Implements high-performance WebGPU rendering while maintaining contract compatibility
 * with maxGraph VisualCanvas and CanvasOverlay controls.
 */

import { WebGpuPidEngine } from '../webgpu/engine';
import { WebGpuPidAdapter } from '../webgpu/adapter';
import { SpatialCullingController } from '../webgpu/spatial/cullingController';
import type { PidView } from '../model/view/projection';
import { projectToView } from '../model/view/projection';
import type { SelectionInfo } from '../common/types';

export interface CanvasCallbacks {
  onModelChanged: (view: PidView) => void;
  onSelectionChanged: (selection: SelectionInfo | null) => void;
  onGridChanged?: (visible: boolean) => void;
  onZoomChanged?: (scale: number) => void;
}

export class WebGpuVisualCanvas {
  private canvasElement: HTMLCanvasElement;
  private engine: WebGpuPidEngine;
  private adapter = new WebGpuPidAdapter();
  private culler = new SpatialCullingController({ marginPx: 200 });

  private currentView: PidView | null = null;
  private gridVisible = true;
  private initialized = false;

  constructor(
    private readonly container: HTMLElement,
    private readonly callbacks: CanvasCallbacks
  ) {
    this.canvasElement = document.createElement('canvas');
    this.canvasElement.className = 'graph-canvas webgpu-canvas';
    this.canvasElement.style.width = '100%';
    this.canvasElement.style.height = '100%';
    this.canvasElement.style.display = 'block';

    // Clear existing children or insert canvas
    this.container.appendChild(this.canvasElement);

    this.engine = new WebGpuPidEngine(this.canvasElement);
  }

  public static isSupported(): boolean {
    return typeof navigator !== 'undefined' && Boolean(navigator.gpu);
  }

  public async init(): Promise<void> {
    if (this.initialized) return;

    this.resizeCanvas();
    window.addEventListener('resize', this.onResize);

    await this.engine.initialize();
    this.engine.start();
    this.initialized = true;
  }

  public renderModel(viewOrModel: PidView | any): void {
    const view: PidView =
      viewOrModel && 'nodes' in viewOrModel
        ? (viewOrModel as PidView)
        : projectToView(viewOrModel);

    this.currentView = view;

    // 1. Build spatial bounds for culling
    const nodes = view.nodes;
    const boxes = new Float32Array(nodes.length * 4);
    const ids = new Uint32Array(nodes.length);

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const offset = i * 4;
      boxes[offset + 0] = n.x;
      boxes[offset + 1] = n.y;
      boxes[offset + 2] = n.x + (n.w || 40);
      boxes[offset + 3] = n.y + (n.h || 40);
      ids[i] = this.adapter.getEntityId(n.id);
    }
    this.culler.buildIndex(boxes, ids);

    // 2. Load geometry into WebGPU engine
    if (this.initialized) {
      this.engine.loadPidView(view);
      this.engine.renderFrame();
    }
  }

  public zoomIn(): void {
    this.engine.camera.zoom = Math.min(50.0, this.engine.camera.zoom * 1.25);
    this.callbacks.onZoomChanged?.(this.getZoom());
    this.engine.renderFrame();
  }

  public zoomOut(): void {
    this.engine.camera.zoom = Math.max(0.01, this.engine.camera.zoom * 0.8);
    this.callbacks.onZoomChanged?.(this.getZoom());
    this.engine.renderFrame();
  }

  public zoomReset(): void {
    this.engine.camera.zoom = 1.0;
    this.engine.camera.x = 0;
    this.engine.camera.y = 0;
    this.callbacks.onZoomChanged?.(1.0);
    this.engine.renderFrame();
  }

  public zoomFit(): void {
    if (!this.currentView || this.currentView.nodes.length === 0) {
      this.zoomReset();
      return;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const n of this.currentView.nodes) {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + (n.w || 40));
      maxY = Math.max(maxY, n.y + (n.h || 40));
    }

    const boundsW = Math.max(maxX - minX, 100);
    const boundsH = Math.max(maxY - minY, 100);

    const vpW = this.canvasElement.clientWidth || 800;
    const vpH = this.canvasElement.clientHeight || 600;

    const fitZoom = Math.min((vpW * 0.85) / boundsW, (vpH * 0.85) / boundsH);
    this.engine.camera.zoom = Math.max(0.01, Math.min(2.0, fitZoom));
    this.engine.camera.x = (minX + maxX) * 0.5;
    this.engine.camera.y = (minY + maxY) * 0.5;

    this.callbacks.onZoomChanged?.(this.getZoom());
    this.engine.renderFrame();
  }

  public toggleGrid(): void {
    this.setGridVisible(!this.gridVisible);
  }

  public setGridVisible(visible: boolean): void {
    this.gridVisible = visible;
    if (visible) {
      this.canvasElement.classList.remove('grid-hidden');
    } else {
      this.canvasElement.classList.add('grid-hidden');
    }
    this.callbacks.onGridChanged?.(visible);
  }

  public getZoom(): number {
    return Math.round(this.engine.camera.zoom * 100) / 100;
  }

  public insertSymbol(item: any): void {
    // Forwarded to model change callback
    if (!this.currentView) return;
    const newNode = {
      id: `elem_${Date.now()}`,
      kind: 'pipingComponent' as const,
      dexpiClass: item?.dexpiClass || 'GateValve',
      tagName: item?.name || 'VALVE',
      x: this.engine.camera.x,
      y: this.engine.camera.y,
      w: 40,
      h: 40,
      attributes: {},
    };
    this.currentView.nodes.push(newNode);
    this.renderModel(this.currentView);
    this.callbacks.onModelChanged(this.currentView);
  }

  public updateCellAttribute(id: string, property: string, value: any): void {
    if (!this.currentView) return;
    const node = this.currentView.nodes.find((n) => n.id === id);
    if (node) {
      node.attributes[property] = String(value);
      this.renderModel(this.currentView);
      this.callbacks.onModelChanged(this.currentView);
    }
  }

  public exportSvg(): string {
    // Generate an SVG projection from currentView
    if (!this.currentView) return '<svg></svg>';
    const nodes = this.currentView.nodes;
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="800">`;
    for (const n of nodes) {
      svg += `<rect x="${n.x}" y="${n.y}" width="${n.w || 40}" height="${n.h || 40}" fill="#1e1e1e" stroke="#00f2fe" stroke-width="2"/>`;
      if (n.tagName) {
        svg += `<text x="${n.x}" y="${n.y + (n.h || 40) + 12}" fill="#e6e6e6" font-size="10">${n.tagName}</text>`;
      }
    }
    svg += `</svg>`;
    return svg;
  }

  private onResize = (): void => {
    this.resizeCanvas();
    this.engine.renderFrame();
  };

  private resizeCanvas(): void {
    const dpr = window.devicePixelRatio || 1;
    const w = this.container.clientWidth || 800;
    const h = this.container.clientHeight || 600;

    this.canvasElement.width = Math.floor(w * dpr);
    this.canvasElement.height = Math.floor(h * dpr);

    this.engine.camera.viewportWidth = w;
    this.engine.camera.viewportHeight = h;
  }

  public dispose(): void {
    window.removeEventListener('resize', this.onResize);
    this.engine.dispose();
    if (this.canvasElement.parentElement) {
      this.canvasElement.parentElement.removeChild(this.canvasElement);
    }
  }
}


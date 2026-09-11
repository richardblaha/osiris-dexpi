/**
 * WebGPU Visual Canvas for Osiris P&ID Editor
 *
 * Implements a complete high-performance CAD visual editor:
 * - Direct WebGPU rendering (60 FPS zoom & pan)
 * - Analytical hit-testing for nodes and polylines
 * - Interactive node dragging with real-time connected pipe updates
 * - Two-layer interaction overlay: selection gizmo, connection ports, live A* routing preview
 * - Inline KKS label editing on double click
 * - Deletion of selected components with Delete / Backspace
 */

import { WebGpuPidEngine } from '../webgpu/engine';
import { WebGpuPidAdapter } from '../webgpu/adapter';
import { SpatialCullingController } from '../webgpu/spatial/cullingController';
import { OrthogonalRouter } from '../webgpu/routing/orthogonalRouter';
import { InteractionOverlay } from './interactionOverlay';
import { DiagramSvgLayer } from './diagramSvgLayer';
import type { PidView, PidViewNode, PidViewEdge } from '../model/view/projection';
import { projectToView } from '../model/view/projection';
import { exportPidViewToSvg } from './exportSvg';
import type { SelectionInfo, ValidationIssue } from '../common/types';

export interface CanvasCallbacks {
  onModelChanged: (view: PidView) => void;
  onSelectionChanged: (selection: SelectionInfo | null) => void;
  onGridChanged?: (visible: boolean) => void;
  onZoomChanged?: (scale: number) => void;
}

interface ConnectionPort {
  nodeId: string;
  portIndex: number;
  worldX: number;
  worldY: number;
}

export class WebGpuVisualCanvas {
  /**
   * Interactive editing (select, drag, connect, inline-edit, rotate/mirror/delete)
   * is off for now while diagram rendering fidelity is being tuned — only pan and
   * zoom stay live. Flip this back on to restore the full CAD interaction set.
   */
  private static readonly INTERACTIVE_EDITING = false;

  /**
   * Flow-direction arrows and DRC validation badges (the small triangle/circle
   * markers `InteractionOverlay` draws over the diagram) are off for now too —
   * pure focus on the diagram rendering itself (`DiagramSvgLayer`) while its
   * fidelity is tuned. Selection gizmo / hover ports / marquee / route-preview
   * are already inert since they're only ever populated from the interactive
   * gestures gated by `INTERACTIVE_EDITING` above.
   */
  private static readonly SHOW_OVERLAY_DECORATIONS = false;

  private canvasElement: HTMLCanvasElement;
  private engine: WebGpuPidEngine;
  private adapter = new WebGpuPidAdapter();
  private culler = new SpatialCullingController({ marginPx: 200 });
  private overlay: InteractionOverlay;
  private diagramLayer: DiagramSvgLayer;

  private currentView: PidView | null = null;
  private gridVisible = true;
  private initialized = false;
  private hasAutoFitted = false;

  // History Stack (Undo / Redo)
  private undoStack: string[] = [];
  private redoStack: string[] = [];
  private readonly maxHistory = 50;

  // Interactive selection and editing state
  private selectedNodes: PidViewNode[] = [];
  private selectedEdge: PidViewEdge | null = null;

  public get selectedNode(): PidViewNode | null {
    return this.selectedNodes[0] || null;
  }

  // Dragging & Marquee state
  private isDragging = false;
  private isDraggingNode = false;
  private isMarqueeSelecting = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private marqueeStartWorld = { x: 0, y: 0 };
  private nodeInitialPositions = new Map<string, { x: number; y: number }>();

  // Pipeline creation mode
  private connectingStartPort: ConnectionPort | null = null;
  private currentLineKind: 'pipe' | 'signal' = 'pipe';

  constructor(
    private readonly container: HTMLElement,
    private readonly callbacks: CanvasCallbacks
  ) {
    this.canvasElement = document.createElement('canvas');
    this.canvasElement.className = 'graph-canvas webgpu-canvas';
    this.canvasElement.style.width = '100%';
    this.canvasElement.style.height = '100%';
    this.canvasElement.style.display = 'block';

    this.container.appendChild(this.canvasElement);
    this.engine = new WebGpuPidEngine(this.canvasElement);

    // Draws real stencil/piping/text content on top of the WebGPU canvas (which
    // only paints simplified placeholder shapes); layered below the interaction
    // overlay's selection/routing/DRC chrome, appended right after it below.
    this.diagramLayer = new DiagramSvgLayer(this.container);

    this.overlay = new InteractionOverlay(this.container, {
      onTextEdited: (elementId, newText) => {
        this.handleInlineTextEdited(elementId, newText);
      },
    });

    this.setupInteractionListeners();
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

  public setLineKind(kind: 'pipe' | 'signal'): void {
    this.currentLineKind = kind;
  }

  public saveUndoState(): void {
    if (!this.currentView) return;
    this.undoStack.push(JSON.stringify(this.currentView));
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  public undo(): void {
    if (!WebGpuVisualCanvas.INTERACTIVE_EDITING) return;
    if (this.undoStack.length === 0 || !this.currentView) return;
    this.redoStack.push(JSON.stringify(this.currentView));
    this.currentView = JSON.parse(this.undoStack.pop()!);
    this.clearSelection();
    this.renderModel(this.currentView);
    this.callbacks.onModelChanged(this.currentView!);
  }

  public redo(): void {
    if (!WebGpuVisualCanvas.INTERACTIVE_EDITING) return;
    if (this.redoStack.length === 0 || !this.currentView) return;
    this.undoStack.push(JSON.stringify(this.currentView));
    this.currentView = JSON.parse(this.redoStack.pop()!);
    this.clearSelection();
    this.renderModel(this.currentView);
    this.callbacks.onModelChanged(this.currentView!);
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

    // 3. Draw the real diagram content (stencils, piping, labels) as SVG
    this.diagramLayer.render(view, this.engine.camera);

    // 4. Update overlay with flow direction arrows and DRC markers
    this.updateFlowArrowsAndDrc();
    this.syncOverlays();

    // On the very first model load, frame the whole diagram — otherwise the
    // camera starts at world (0,0)/zoom 1, which for a real-world-sized DEXPI
    // diagram shows only a small, arbitrary corner of it (looking like a pile
    // of unrelated, overlapping fragments rather than a laid-out P&ID).
    if (!this.hasAutoFitted && view.nodes.length > 0) {
      this.hasAutoFitted = true;
      this.zoomFit();
    }
  }

  /** Keeps the interaction-chrome overlay and the diagram content layer's viewBox in sync with the camera. */
  private syncOverlays(): void {
    this.overlay.update(this.engine.camera);
    this.diagramLayer.setViewBox(this.engine.camera);
  }

  // ── Navigation & View Controls ──────────────────────────────────────────

  public zoomIn(): void {
    this.engine.camera.zoom = Math.min(50.0, this.engine.camera.zoom * 1.25);
    this.callbacks.onZoomChanged?.(this.getZoom());
    this.engine.renderFrame();
    this.syncOverlays();
  }

  public zoomOut(): void {
    this.engine.camera.zoom = Math.max(0.01, this.engine.camera.zoom * 0.8);
    this.callbacks.onZoomChanged?.(this.getZoom());
    this.engine.renderFrame();
    this.syncOverlays();
  }

  public zoomReset(): void {
    this.engine.camera.zoom = 1.0;
    this.engine.camera.x = 0;
    this.engine.camera.y = 0;
    this.callbacks.onZoomChanged?.(1.0);
    this.engine.renderFrame();
    this.syncOverlays();
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
    this.syncOverlays();
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

  public getCurrentView(): PidView | null {
    return this.currentView;
  }

  public getLineKind(): 'pipe' | 'signal' {
    return this.currentLineKind;
  }

  public toggleLineMode(): 'pipe' | 'signal' {
    this.currentLineKind = this.currentLineKind === 'pipe' ? 'signal' : 'pipe';
    return this.currentLineKind;
  }

  public rotateSelected(): void {
    if (!WebGpuVisualCanvas.INTERACTIVE_EDITING) return;
    if (this.selectedNodes.length > 0 && this.currentView) {
      this.saveUndoState();
      for (const node of this.selectedNodes) {
        node.rotation = ((node.rotation || 0) + 90) % 360;
        this.updateConnectedEdgeEndpoints(node);
      }
      this.renderModel(this.currentView);
      this.callbacks.onModelChanged(this.currentView);
    }
  }

  public mirrorSelected(): void {
    if (!WebGpuVisualCanvas.INTERACTIVE_EDITING) return;
    if (this.selectedNodes.length > 0 && this.currentView) {
      this.saveUndoState();
      for (const node of this.selectedNodes) {
        node.mirrored = !node.mirrored;
      }
      this.renderModel(this.currentView);
      this.callbacks.onModelChanged(this.currentView);
    }
  }

  public reverseFlowSelected(): void {
    if (!WebGpuVisualCanvas.INTERACTIVE_EDITING) return;
    if (this.selectedEdge && this.currentView) {
      this.saveUndoState();
      const tmpSrc = this.selectedEdge.sourceId;
      const tmpNode = this.selectedEdge.sourceNode;
      this.selectedEdge.sourceId = this.selectedEdge.targetId;
      this.selectedEdge.sourceNode = this.selectedEdge.targetNode;
      this.selectedEdge.targetId = tmpSrc;
      this.selectedEdge.targetNode = tmpNode;
      if (this.selectedEdge.waypoints) {
        this.selectedEdge.waypoints.reverse();
      }
      this.renderModel(this.currentView);
      this.callbacks.onModelChanged(this.currentView);
    }
  }

  public deleteSelected(): void {
    if (!WebGpuVisualCanvas.INTERACTIVE_EDITING) return;
    if (!this.currentView) return;

    if (this.selectedNodes.length > 0) {
      this.saveUndoState();
      for (const node of this.selectedNodes) {
        const idToDelete = node.id;

        // Auto-heal if deleting an in-line component with 1 incoming and 1 outgoing pipe
        if (node.kind === 'pipingComponent') {
          const inEdge = this.currentView.edges.find((e) => e.targetId === idToDelete && e.sourceId !== idToDelete);
          const outEdge = this.currentView.edges.find((e) => e.sourceId === idToDelete && e.targetId !== idToDelete);
          if (inEdge && outEdge && inEdge.id !== outEdge.id) {
            inEdge.targetId = outEdge.targetId;
            inEdge.targetNode = outEdge.targetNode;
            const w1 = inEdge.waypoints ? inEdge.waypoints.slice(0, -1) : [];
            const w2 = outEdge.waypoints ? outEdge.waypoints.slice(1) : [];
            inEdge.waypoints = [...w1, ...w2];
            this.currentView.edges = this.currentView.edges.filter((e) => e.id !== outEdge.id);
          }
        }

        this.currentView.nodes = this.currentView.nodes.filter((n) => n.id !== idToDelete);
        this.currentView.edges = this.currentView.edges.filter(
          (e) => e.sourceId !== idToDelete && e.targetId !== idToDelete
        );
      }
      this.clearSelection();
      this.renderModel(this.currentView);
      this.callbacks.onModelChanged(this.currentView);
    } else if (this.selectedEdge) {
      this.saveUndoState();
      const idToDelete = this.selectedEdge.id;
      this.currentView.edges = this.currentView.edges.filter((e) => e.id !== idToDelete);
      this.clearSelection();
      this.renderModel(this.currentView);
      this.callbacks.onModelChanged(this.currentView);
    }
  }

  // ── Palette Insertion & Attribute Updates ───────────────────────────────

  public insertSymbol(item: any): void {
    if (!WebGpuVisualCanvas.INTERACTIVE_EDITING) return;
    if (!this.currentView) return;
    this.saveUndoState();
    const newNode: PidViewNode = {
      id: `elem_${Date.now()}`,
      kind: (item?.kind as any) || 'pipingComponent',
      dexpiClass: item?.dexpiClass || 'GateValve',
      tagName: item?.name || 'VALVE',
      x: this.engine.camera.x - 20,
      y: this.engine.camera.y - 20,
      w: 40,
      h: 40,
      attributes: {
        tag: item?.name || 'VALVE',
      },
    };
    this.currentView.nodes.push(newNode);
    if (newNode.kind === 'pipingComponent') {
      this.checkAndSplitEdgeForComponent(newNode);
    }
    this.selectNode(newNode);
    this.renderModel(this.currentView);
    this.callbacks.onModelChanged(this.currentView);
  }

  public updateCellAttribute(id: string, property: string, value: any): void {
    if (!WebGpuVisualCanvas.INTERACTIVE_EDITING) return;
    if (!this.currentView) return;
    const node = this.currentView.nodes.find((n) => n.id === id);
    if (node) {
      this.saveUndoState();
      const key = property.startsWith('attr:') ? property.slice(5) : property;
      node.attributes[key] = String(value);
      if (key === 'tagName' || key === 'tag') {
        node.tagName = String(value);
      }
      this.renderModel(this.currentView);
      this.callbacks.onModelChanged(this.currentView);
    }
  }

  public exportSvg(): string {
    if (!this.currentView) return '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"></svg>';
    return exportPidViewToSvg(this.currentView);
  }

  // ── Analytical Hit-Testing & Interactive Events ─────────────────────────

  private setupInteractionListeners(): void {
    this.canvasElement.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    this.canvasElement.addEventListener('dblclick', this.onDoubleClick);
    window.addEventListener('keydown', this.onKeyDown);

    this.canvasElement.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.15 : 0.85;
        this.engine.camera.zoom = Math.max(0.005, Math.min(100.0, this.cameraZoom * factor));
        this.callbacks.onZoomChanged?.(this.getZoom());
        this.engine.renderFrame();
        this.syncOverlays();
      },
      { passive: false }
    );
  }

  private get cameraZoom(): number {
    return this.engine.camera.zoom;
  }

  private screenToWorld(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvasElement.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;

    const { x, y, zoom, viewportWidth, viewportHeight } = this.engine.camera;
    const wx = (sx - viewportWidth * 0.5) / zoom + x;
    const wy = (sy - viewportHeight * 0.5) / zoom + y;
    return { x: wx, y: wy };
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (e.button !== 0) return; // Left button only

    const world = this.screenToWorld(e.clientX, e.clientY);
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;

    if (!WebGpuVisualCanvas.INTERACTIVE_EDITING) {
      // Selection/drag/connect are off for now — every left-button drag just pans.
      this.isDragging = true;
      return;
    }

    // 1. Check if clicking on an active connection port (Start drawing a pipeline)
    const nearbyPort = this.findNearbyPort(world.x, world.y);
    if (nearbyPort) {
      if (!this.connectingStartPort) {
        // Start pipeline drawing mode
        this.connectingStartPort = nearbyPort;
        this.overlay.setRoutePreview([{ x: nearbyPort.worldX, y: nearbyPort.worldY }, world]);
        this.syncOverlays();
        return;
      } else if (this.connectingStartPort.nodeId !== nearbyPort.nodeId) {
        // Complete connection!
        this.completePipelineConnection(this.connectingStartPort, nearbyPort);
        this.connectingStartPort = null;
        this.overlay.setRoutePreview(null);
        this.syncOverlays();
        return;
      }
    }

    // If already in connection mode and clicked elsewhere, cancel connection
    if (this.connectingStartPort) {
      this.connectingStartPort = null;
      this.overlay.setRoutePreview(null);
      this.syncOverlays();
    }

    // 2. Hit-test nodes
    const hitNode = this.hitTestNode(world.x, world.y);
    if (hitNode) {
      this.saveUndoState();
      if (e.shiftKey) {
        // Multi-selection toggle
        const exists = this.selectedNodes.some((n) => n.id === hitNode.id);
        if (exists) {
          this.selectNodes(this.selectedNodes.filter((n) => n.id !== hitNode.id));
        } else {
          this.selectNodes([...this.selectedNodes, hitNode]);
        }
      } else {
        if (!this.selectedNodes.some((n) => n.id === hitNode.id)) {
          this.selectNodes([hitNode]);
        }
      }

      this.isDraggingNode = true;
      this.nodeInitialPositions.clear();
      for (const n of this.selectedNodes) {
        this.nodeInitialPositions.set(n.id, { x: n.x, y: n.y });
      }
      return;
    }

    // 3. Hit-test edges
    const hitEdge = this.hitTestEdge(world.x, world.y);
    if (hitEdge) {
      this.selectEdge(hitEdge);
      return;
    }

    // 4. Background click
    if (e.shiftKey) {
      // Shift + click on background -> start Marquee selection!
      this.clearSelection();
      this.isMarqueeSelecting = true;
      this.marqueeStartWorld = { x: world.x, y: world.y };
    } else {
      this.clearSelection();
      this.isDragging = true;
    }
  };

  private onPointerMove = (e: PointerEvent): void => {
    const world = this.screenToWorld(e.clientX, e.clientY);

    // Selection/drag/connect/hover-port previews are off for now — fall straight
    // through to panning (step 4 below).
    if (!WebGpuVisualCanvas.INTERACTIVE_EDITING) {
      if (this.isDragging) {
        const dx = e.clientX - this.dragStartX;
        const dy = e.clientY - this.dragStartY;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;

        this.engine.camera.x -= dx / this.engine.camera.zoom;
        this.engine.camera.y -= dy / this.engine.camera.zoom;
        this.engine.renderFrame();
        this.syncOverlays();
      }
      return;
    }

    // 1. Pipeline drawing preview update
    if (this.connectingStartPort) {
      const snappedPort = this.findNearbyPort(world.x, world.y);
      const targetPoint = snappedPort
        ? { x: snappedPort.worldX, y: snappedPort.worldY }
        : world;

      const obstacles = (this.currentView?.nodes || [])
        .filter((n) => n.id !== this.connectingStartPort?.nodeId && n.id !== snappedPort?.nodeId)
        .map((n) => ({
          minX: n.x,
          minY: n.y,
          maxX: n.x + (n.w || 40),
          maxY: n.y + (n.h || 40),
        }));

      const routePts = OrthogonalRouter.route({
        start: { x: this.connectingStartPort.worldX, y: this.connectingStartPort.worldY },
        end: targetPoint,
        obstacles,
        gridSize: 10,
      });

      this.overlay.setRoutePreview(routePts);
      this.syncOverlays();
      return;
    }

    // 2. Marquee Selection update
    if (this.isMarqueeSelecting) {
      this.overlay.setMarqueeRect({
        x1: this.marqueeStartWorld.x,
        y1: this.marqueeStartWorld.y,
        x2: world.x,
        y2: world.y,
      });
      this.syncOverlays();
      return;
    }

    // 3. Node dragging (supports single or multi-selection)
    if (this.isDraggingNode && this.selectedNodes.length > 0) {
      const dx = (e.clientX - this.dragStartX) / this.engine.camera.zoom;
      const dy = (e.clientY - this.dragStartY) / this.engine.camera.zoom;

      for (const node of this.selectedNodes) {
        const init = this.nodeInitialPositions.get(node.id);
        if (init) {
          node.x = Math.round((init.x + dx) / 10) * 10;
          node.y = Math.round((init.y + dy) / 10) * 10;
          this.updateConnectedEdgeEndpoints(node);
        }
      }

      if (this.currentView) {
        this.renderModel(this.currentView);
      }
      return;
    }

    // 4. Panning
    if (this.isDragging) {
      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;

      this.engine.camera.x -= dx / this.engine.camera.zoom;
      this.engine.camera.y -= dy / this.engine.camera.zoom;
      this.engine.renderFrame();
      this.syncOverlays();
      return;
    }

    // 5. Hover detection for connection ports
    const hoveredNode = this.hitTestNode(world.x, world.y, 25);
    if (hoveredNode) {
      const ports = this.getNodePorts(hoveredNode);
      this.overlay.setHoveredPorts(ports);
      this.syncOverlays();
    } else {
      this.overlay.setHoveredPorts([]);
      this.syncOverlays();
    }
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (!WebGpuVisualCanvas.INTERACTIVE_EDITING) {
      this.isDragging = false;
      return;
    }

    const world = this.screenToWorld(e.clientX, e.clientY);

    // 1. Finish Marquee Selection
    if (this.isMarqueeSelecting && this.currentView) {
      this.isMarqueeSelecting = false;
      this.overlay.setMarqueeRect(null);

      const minX = Math.min(this.marqueeStartWorld.x, world.x);
      const maxX = Math.max(this.marqueeStartWorld.x, world.x);
      const minY = Math.min(this.marqueeStartWorld.y, world.y);
      const maxY = Math.max(this.marqueeStartWorld.y, world.y);

      const matched = this.currentView.nodes.filter((n) => {
        const nw = n.w || 40;
        const nh = n.h || 40;
        return n.x + nw >= minX && n.x <= maxX && n.y + nh >= minY && n.y <= maxY;
      });

      this.selectNodes(matched);
      this.syncOverlays();
      return;
    }

    // 2. Finish Node Dragging
    if (this.isDraggingNode && this.currentView) {
      this.isDraggingNode = false;
      // In-line insertion check: if a dragged piping component was dropped on an edge, auto-split
      for (const node of this.selectedNodes) {
        if (node.kind === 'pipingComponent') {
          this.checkAndSplitEdgeForComponent(node);
        }
      }
      this.renderModel(this.currentView);
      this.callbacks.onModelChanged(this.currentView);
    }

    this.isDragging = false;
  };

  private onDoubleClick = (e: MouseEvent): void => {
    if (!WebGpuVisualCanvas.INTERACTIVE_EDITING) return;
    const world = this.screenToWorld(e.clientX, e.clientY);
    const hitNode = this.hitTestNode(world.x, world.y);

    if (hitNode) {
      this.overlay.startInlineEditing(
        hitNode.id,
        hitNode.tagName || 'VALVE',
        hitNode.x + (hitNode.w || 40) * 0.5,
        hitNode.y + (hitNode.h || 40) + 12,
        this.engine.camera
      );
    }
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
    if (targetTag === 'input' || targetTag === 'textarea') return;
    if (!WebGpuVisualCanvas.INTERACTIVE_EDITING) return;

    // Undo / Redo
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) {
        this.redo();
      } else {
        this.undo();
      }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      this.redo();
      return;
    }

    // Rotation (R) - 90 deg clockwise
    if (e.key === 'r' || e.key === 'R') {
      if (this.selectedNodes.length > 0 && this.currentView) {
        e.preventDefault();
        this.saveUndoState();
        for (const node of this.selectedNodes) {
          node.rotation = ((node.rotation || 0) + 90) % 360;
          this.updateConnectedEdgeEndpoints(node);
        }
        this.renderModel(this.currentView);
        this.callbacks.onModelChanged(this.currentView);
        return;
      }
    }

    // Mirror (M)
    if (e.key === 'm' || e.key === 'M') {
      if (this.selectedNodes.length > 0 && this.currentView) {
        e.preventDefault();
        this.saveUndoState();
        for (const node of this.selectedNodes) {
          node.mirrored = !node.mirrored;
        }
        this.renderModel(this.currentView);
        this.callbacks.onModelChanged(this.currentView);
        return;
      }
    }

    // Flow Reverse (F)
    if (e.key === 'f' || e.key === 'F') {
      if (this.selectedEdge && this.currentView) {
        e.preventDefault();
        this.saveUndoState();
        const tmpSrc = this.selectedEdge.sourceId;
        const tmpNode = this.selectedEdge.sourceNode;
        this.selectedEdge.sourceId = this.selectedEdge.targetId;
        this.selectedEdge.sourceNode = this.selectedEdge.targetNode;
        this.selectedEdge.targetId = tmpSrc;
        this.selectedEdge.targetNode = tmpNode;
        if (this.selectedEdge.waypoints) {
          this.selectedEdge.waypoints.reverse();
        }
        this.renderModel(this.currentView);
        this.callbacks.onModelChanged(this.currentView);
        return;
      }
    }

    // Delete / Backspace (with Auto-Heal for piping components)
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (this.selectedNodes.length > 0 && this.currentView) {
        e.preventDefault();
        this.saveUndoState();
        for (const node of this.selectedNodes) {
          const idToDelete = node.id;

          // Auto-heal if deleting an in-line component with 1 incoming and 1 outgoing pipe
          if (node.kind === 'pipingComponent') {
            const inEdge = this.currentView.edges.find((edge) => edge.targetId === idToDelete && edge.sourceId !== idToDelete);
            const outEdge = this.currentView.edges.find((edge) => edge.sourceId === idToDelete && edge.targetId !== idToDelete);
            if (inEdge && outEdge && inEdge.id !== outEdge.id) {
              inEdge.targetId = outEdge.targetId;
              inEdge.targetNode = outEdge.targetNode;
              const w1 = inEdge.waypoints ? inEdge.waypoints.slice(0, -1) : [];
              const w2 = outEdge.waypoints ? outEdge.waypoints.slice(1) : [];
              inEdge.waypoints = [...w1, ...w2];
              this.currentView.edges = this.currentView.edges.filter((edge) => edge.id !== outEdge.id);
            }
          }

          this.currentView.nodes = this.currentView.nodes.filter((n) => n.id !== idToDelete);
          this.currentView.edges = this.currentView.edges.filter(
            (edge) => edge.sourceId !== idToDelete && edge.targetId !== idToDelete
          );
        }
        this.clearSelection();
        this.renderModel(this.currentView);
        this.callbacks.onModelChanged(this.currentView);
      } else if (this.selectedEdge && this.currentView) {
        e.preventDefault();
        this.saveUndoState();
        const idToDelete = this.selectedEdge.id;
        this.currentView.edges = this.currentView.edges.filter((e) => e.id !== idToDelete);
        this.clearSelection();
        this.renderModel(this.currentView);
        this.callbacks.onModelChanged(this.currentView);
      }
    } else if (e.key === 'Escape') {
      this.connectingStartPort = null;
      this.isMarqueeSelecting = false;
      this.overlay.setMarqueeRect(null);
      this.overlay.setRoutePreview(null);
      this.clearSelection();
      this.syncOverlays();
    }
  };

  // ── Hit Testing Details ─────────────────────────────────────────────────

  private hitTestNode(wx: number, wy: number, padding = 4): PidViewNode | null {
    if (!this.currentView) return null;
    const nodes = this.currentView.nodes;

    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      const w = n.w || 40;
      const h = n.h || 40;
      if (
        wx >= n.x - padding &&
        wx <= n.x + w + padding &&
        wy >= n.y - padding &&
        wy <= n.y + h + padding
      ) {
        return n;
      }
    }
    return null;
  }

  private hitTestEdge(wx: number, wy: number): PidViewEdge | null {
    if (!this.currentView) return null;
    const tolerance = 10 / this.engine.camera.zoom;

    for (const edge of this.currentView.edges) {
      if (!edge.waypoints || edge.waypoints.length < 2) continue;
      for (let i = 0; i < edge.waypoints.length - 1; i++) {
        const p1 = edge.waypoints[i];
        const p2 = edge.waypoints[i + 1];
        if (this.distToSegment(wx, wy, p1.x, p1.y, p2.x, p2.y) <= tolerance) {
          return edge;
        }
      }
    }
    return null;
  }

  private distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
  }

  public selectNode(node: PidViewNode): void {
    this.selectNodes([node]);
  }

  public selectNodes(nodes: PidViewNode[]): void {
    this.selectedNodes = nodes;
    this.selectedEdge = null;
    this.overlay.setSelectedNodes(nodes);
    this.syncOverlays();

    if (nodes.length === 1) {
      const node = nodes[0];
      const attrs: Record<string, { value: string; units?: string }> = {};
      for (const [k, v] of Object.entries(node.attributes || {})) {
        attrs[k] = { value: String(v) };
      }
      this.callbacks.onSelectionChanged({
        id: node.id,
        elementType: node.kind,
        componentClass: node.dexpiClass,
        tagName: node.tagName,
        isEdge: false,
        attributes: attrs,
      });
    } else if (nodes.length > 1) {
      this.callbacks.onSelectionChanged({
        id: 'multiple',
        elementType: 'multiple',
        componentClass: 'MultiSelection',
        tagName: `${nodes.length} items selected`,
        isEdge: false,
        attributes: { count: { value: String(nodes.length) } },
      });
    } else {
      this.callbacks.onSelectionChanged(null);
    }
  }

  public selectEdge(edge: PidViewEdge): void {
    this.selectedEdge = edge;
    this.selectedNodes = [];
    this.overlay.setSelectedEdge(edge);
    this.syncOverlays();

    const attrs: Record<string, { value: string; units?: string }> = {};
    for (const [k, v] of Object.entries(edge.attributes || {})) {
      attrs[k] = { value: String(v) };
    }

    this.callbacks.onSelectionChanged({
      id: edge.id,
      elementType: edge.kind,
      componentClass: edge.dexpiClass,
      tagName: edge.label || 'PIPELINE',
      isEdge: true,
      attributes: attrs,
    });
  }

  public clearSelection(): void {
    this.selectedNodes = [];
    this.selectedEdge = null;
    this.overlay.setSelectedNodes([]);
    this.overlay.setSelectedEdge(null);
    this.syncOverlays();
    this.callbacks.onSelectionChanged(null);
  }

  private handleInlineTextEdited(elementId: string, newText: string): void {
    if (!this.currentView) return;
    const node = this.currentView.nodes.find((n) => n.id === elementId);
    if (node) {
      this.saveUndoState();
      node.tagName = newText;
      node.attributes.tag = newText;
      this.renderModel(this.currentView);
      this.callbacks.onModelChanged(this.currentView);
    }
  }

  // ── Auto-Split In-line Piping Components ────────────────────────────────

  public checkAndSplitEdgeForComponent(node: PidViewNode): boolean {
    if (!this.currentView) return false;
    const cx = node.x + (node.w || 40) * 0.5;
    const cy = node.y + (node.h || 40) * 0.5;
    const tolerance = 18;

    for (let eIdx = 0; eIdx < this.currentView.edges.length; eIdx++) {
      const edge = this.currentView.edges[eIdx];
      if (edge.sourceId === node.id || edge.targetId === node.id) continue;
      if (!edge.waypoints || edge.waypoints.length < 2) continue;

      for (let sIdx = 0; sIdx < edge.waypoints.length - 1; sIdx++) {
        const p1 = edge.waypoints[sIdx];
        const p2 = edge.waypoints[sIdx + 1];
        if (this.distToSegment(cx, cy, p1.x, p1.y, p2.x, p2.y) <= tolerance) {
          const pts1 = [...edge.waypoints.slice(0, sIdx + 1), { x: cx, y: cy }];
          const pts2 = [{ x: cx, y: cy }, ...edge.waypoints.slice(sIdx + 1)];

          const originalTarget = edge.targetId;
          const originalTargetNode = edge.targetNode;

          edge.targetId = node.id;
          edge.targetNode = undefined;
          edge.waypoints = pts1;

          const newEdge: PidViewEdge = {
            id: `pipe_${Date.now()}`,
            kind: edge.kind,
            dexpiClass: edge.dexpiClass,
            sourceId: node.id,
            targetId: originalTarget,
            targetNode: originalTargetNode,
            waypoints: pts2,
            label: edge.label,
            attributes: { ...(edge.attributes || {}) },
          };

          this.currentView.edges.push(newEdge);
          return true;
        }
      }
    }
    return false;
  }

  // ── Flow Direction & DRC Validation ─────────────────────────────────────

  private updateFlowArrowsAndDrc(): void {
    if (!this.currentView) return;

    if (!WebGpuVisualCanvas.SHOW_OVERLAY_DECORATIONS) {
      this.overlay.setFlowArrows([]);
      this.overlay.setValidationIssues([]);
      return;
    }

    // 1. Flow direction arrows
    const arrows: Array<{ x: number; y: number; angleRad: number }> = [];
    for (const edge of this.currentView.edges) {
      if (!edge.waypoints || edge.waypoints.length < 2) continue;
      for (let i = 0; i < edge.waypoints.length - 1; i++) {
        const p1 = edge.waypoints[i];
        const p2 = edge.waypoints[i + 1];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.hypot(dx, dy);
        if (len > 35) {
          arrows.push({
            x: p1.x + dx * 0.5,
            y: p1.y + dy * 0.5,
            angleRad: Math.atan2(dy, dx),
          });
        }
      }
    }
    this.overlay.setFlowArrows(arrows);

    // 2. Real-time DRC Validation markers
    const issues: Array<{ x: number; y: number; message: string; severity: 'error' | 'warning' }> = [];
    const nodeIds = new Set(this.currentView.nodes.map((n) => n.id));
    const tagNames = new Map<string, number>();

    for (const n of this.currentView.nodes) {
      if (!n.tagName) {
        issues.push({
          x: n.x + (n.w || 40) * 0.5,
          y: n.y - 6,
          message: `Warning: Element ${n.id} has no TagName`,
          severity: 'warning',
        });
      } else {
        const count = (tagNames.get(n.tagName) || 0) + 1;
        tagNames.set(n.tagName, count);
        if (count > 1) {
          issues.push({
            x: n.x + (n.w || 40) * 0.5,
            y: n.y - 6,
            message: `Warning: Duplicate TagName "${n.tagName}"`,
            severity: 'warning',
          });
        }
      }
    }

    for (const e of this.currentView.edges) {
      if (!nodeIds.has(e.sourceId) || !nodeIds.has(e.targetId)) {
        const pt = e.waypoints && e.waypoints.length > 0 ? e.waypoints[0] : { x: 0, y: 0 };
        issues.push({
          x: pt.x,
          y: pt.y,
          message: `Error: Disconnected pipeline segment ${e.id}`,
          severity: 'error',
        });
      }
    }

    // Merge external ISO 15926 / DEXPI schema & semantic issues
    for (const ext of this.externalValidationIssues) {
      if (!ext.elementId) continue;
      const n = this.currentView.nodes.find(
        (node) => node.id === ext.elementId || node.tagName === ext.elementId
      );
      if (n) {
        issues.push({
          x: n.x + (n.w || 40) - 2,
          y: n.y - 2,
          message: `[${ext.code}] ${ext.message}`,
          severity: ext.severity === 'error' ? 'error' : 'warning',
        });
      } else {
        const edge = this.currentView.edges.find(
          (ed) => ed.id === ext.elementId || ed.id.startsWith(ext.elementId!)
        );
        if (edge && edge.waypoints && edge.waypoints.length > 0) {
          const mid = edge.waypoints[Math.floor(edge.waypoints.length / 2)];
          issues.push({
            x: mid.x,
            y: mid.y,
            message: `[${ext.code}] ${ext.message}`,
            severity: ext.severity === 'error' ? 'error' : 'warning',
          });
        }
      }
    }

    this.overlay.setValidationIssues(issues);
  }

  private externalValidationIssues: ValidationIssue[] = [];

  public setExternalValidationIssues(issues: ValidationIssue[]): void {
    this.externalValidationIssues = issues;
    this.updateFlowArrowsAndDrc();
  }

  // ── Nozzle Ports & Connection Logic ─────────────────────────────────────

  private getNodePorts(node: PidViewNode): ConnectionPort[] {
    const w = node.w || 40;
    const h = node.h || 40;
    const cx = node.x + w * 0.5;
    const cy = node.y + h * 0.5;

    // Check if this equipment has explicit child nozzles
    if (this.currentView) {
      const nozzles = this.currentView.nodes.filter((n) => n.parentId === node.id && n.kind === 'nozzle');
      if (nozzles.length > 0) {
        return nozzles.map((noz, idx) => ({
          nodeId: noz.id,
          portIndex: idx,
          worldX: noz.x + (noz.w || 8) * 0.5,
          worldY: noz.y + (noz.h || 8) * 0.5,
        }));
      }
    }

    // Default 4 cardinal connection ports (West, East, North, South)
    return [
      { nodeId: node.id, portIndex: 0, worldX: node.x, worldY: cy },       // West
      { nodeId: node.id, portIndex: 1, worldX: node.x + w, worldY: cy },   // East
      { nodeId: node.id, portIndex: 2, worldX: cx, worldY: node.y },       // North
      { nodeId: node.id, portIndex: 3, worldX: cx, worldY: node.y + h },   // South
    ];
  }

  private findNearbyPort(wx: number, wy: number): ConnectionPort | null {
    if (!this.currentView) return null;
    const snapThreshold = 18 / this.engine.camera.zoom;

    for (const node of this.currentView.nodes) {
      const ports = this.getNodePorts(node);
      for (const p of ports) {
        if (Math.hypot(wx - p.worldX, wy - p.worldY) <= snapThreshold) {
          return p;
        }
      }
    }
    return null;
  }

  private completePipelineConnection(pA: ConnectionPort, pB: ConnectionPort): void {
    if (!this.currentView) return;
    this.saveUndoState();

    const obstacles = this.currentView.nodes
      .filter((n) => n.id !== pA.nodeId && n.id !== pB.nodeId)
      .map((n) => ({
        minX: n.x,
        minY: n.y,
        maxX: n.x + (n.w || 40),
        maxY: n.y + (n.h || 40),
      }));

    const waypoints = OrthogonalRouter.route({
      start: { x: pA.worldX, y: pA.worldY },
      end: { x: pB.worldX, y: pB.worldY },
      obstacles,
      gridSize: 10,
    });

    const isSignal = this.currentLineKind === 'signal';
    const newEdge: PidViewEdge = {
      id: `${isSignal ? 'sig' : 'pipe'}_${Date.now()}`,
      kind: this.currentLineKind,
      dexpiClass: isSignal ? 'SignalConveyingFunction' : 'PipingNetworkSegment',
      sourceId: pA.nodeId,
      targetId: pB.nodeId,
      waypoints,
      label: isSignal ? 'SIG-LINE' : 'DN100-PIPE',
      attributes: {
        nominalDiameter: isSignal ? '' : '100',
        fluidCode: isSignal ? '' : 'PROC',
      },
    };

    this.currentView.edges.push(newEdge);
    this.selectEdge(newEdge);
    this.renderModel(this.currentView);
    this.callbacks.onModelChanged(this.currentView);
  }

  private updateConnectedEdgeEndpoints(node: PidViewNode): void {
    if (!this.currentView) return;
    const cx = node.x + (node.w || 40) * 0.5;
    const cy = node.y + (node.h || 40) * 0.5;

    for (const edge of this.currentView.edges) {
      if (!edge.waypoints || edge.waypoints.length < 2) continue;

      if (edge.sourceId === node.id) {
        edge.waypoints[0] = { x: cx, y: cy };
      }
      if (edge.targetId === node.id) {
        edge.waypoints[edge.waypoints.length - 1] = { x: cx, y: cy };
      }
    }
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────

  private onResize = (): void => {
    this.resizeCanvas();
    this.engine.renderFrame();
    this.syncOverlays();
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
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('keydown', this.onKeyDown);
    this.overlay.dispose();
    this.diagramLayer.dispose();
    this.engine.dispose();
    if (this.canvasElement.parentElement) {
      this.canvasElement.parentElement.removeChild(this.canvasElement);
    }
  }
}

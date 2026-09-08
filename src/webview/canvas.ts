import {
  Graph,
  InternalEvent,
  RubberBandHandler,
  Cell,
  Point,
  EdgeHandlerConfig,
  VertexHandlerConfig,
  type FitPlugin,
  type PanningHandler,
  type ConnectionHandler,
} from '@maxgraph/core';
import type { PidView, PidNodeKind } from '../model/view/projection';
import { DexpiMaxGraphAdapter, registerPidShapes, configureOsirisStylesheet } from '../maxgraph';
import { STYLE_NAMES, type PidStyleTokens } from '../maxgraph/styles';
import { catalogStencilFor, type SymbolCatalogItem } from '../maxgraph/stencils/catalog';
import type { SelectionInfo } from '../common/types';
import type { CellMetadata } from '../maxgraph/adapter';
import { SpatialIndexManager } from './perf/spatialIndex';
import { ViewportCullingController } from './perf/viewportCulling';
import { LodController } from './perf/lod';

export interface CanvasCallbacks {
  onModelChanged: (view: PidView) => void;
  onSelectionChanged: (selection: SelectionInfo | null) => void;
  onGridChanged?: (visible: boolean) => void;
  onZoomChanged?: (scale: number) => void;
}

const ACCENT = '#00f2fe';

export class VisualCanvas {
  private graph: Graph;
  private adapter: DexpiMaxGraphAdapter;
  private rubberband: RubberBandHandler;
  private spatialIndex: SpatialIndexManager;
  private culling: ViewportCullingController;
  private lod: LodController;
  private isUpdatingInternally = false;
  private lastPointerGraphPoint: Point | null = null;
  private gridVisible = true;

  constructor(
    private readonly container: HTMLElement,
    private readonly callbacks: CanvasCallbacks
  ) {
    registerPidShapes();

    VertexHandlerConfig.selectionColor = ACCENT;
    EdgeHandlerConfig.selectionColor = ACCENT;

    this.graph = new Graph(container);
    this.adapter = new DexpiMaxGraphAdapter();

    configureOsirisStylesheet(this.graph.getStylesheet(), readThemeTokens(container));

    this.configureGraph();
    this.rubberband = new RubberBandHandler(this.graph);

    this.spatialIndex = new SpatialIndexManager(this.graph);
    this.culling = new ViewportCullingController(this.graph, container, this.spatialIndex);
    this.lod = new LodController(this.graph, container);

    this.bindEvents();
    this.culling.start();
    this.lod.start();
  }

  public renderModel(viewOrModel: PidView | any): void {
    this.isUpdatingInternally = true;
    try {
      this.adapter.dexpiToGraph(viewOrModel, this.graph);
    } finally {
      this.isUpdatingInternally = false;
    }
    this.spatialIndex.rebuild();
    this.lod.apply();
    this.culling.schedule();
  }

  public getView(): PidView {
    return this.adapter.graphToView(this.graph);
  }

  public zoomIn(): void {
    this.graph.zoomIn();
  }

  public zoomOut(): void {
    this.graph.zoomOut();
  }

  public zoomReset(): void {
    this.graph.zoomActual();
  }

  public zoomFit(): void {
    this.graph.getPlugin<FitPlugin>('fit')?.fitCenter({ margin: 24 });
  }

  public getZoom(): number {
    return this.graph.getView().scale;
  }

  public dispose(): void {
    this.culling.dispose();
    this.lod.dispose();
    this.graph.destroy();
  }

  public isGridVisible(): boolean {
    return this.gridVisible;
  }

  /** Shows/hides the canvas grid and its snapping. */
  public setGridVisible(visible: boolean): void {
    this.gridVisible = visible;
    this.container.classList.toggle('grid-hidden', !visible);
    this.graph.setGridEnabled(visible);
    this.callbacks.onGridChanged?.(visible);
  }

  public toggleGrid(): void {
    this.setGridVisible(!this.gridVisible);
  }

  public exportSvg(): string {
    const svgEl = this.container.querySelector('svg');
    if (!svgEl) return '';
    return new XMLSerializer().serializeToString(svgEl);
  }

  /** Inserts a catalog symbol. When no point is given it lands at the viewport centre. */
  public insertSymbol(item: SymbolCatalogItem, clientX?: number, clientY?: number): void {
    let point: Point;
    if (clientX !== undefined && clientY !== undefined) {
      point = this.graph.getPointForEvent({ clientX, clientY } as MouseEvent);
    } else if (this.lastPointerGraphPoint) {
      point = this.lastPointerGraphPoint;
    } else {
      point = this.viewportCentre();
    }
    const x = Math.round(point.x);
    const y = Math.round(point.y);

    const nextId = `${item.tagPrefix}-${Date.now().toString().slice(-4)}`;
    const tagName = nextId;

    const parent = this.graph.getDefaultParent();
    const modelTransaction = this.graph.getDataModel();

    modelTransaction.beginUpdate();
    try {
      let styleName: string = STYLE_NAMES.EQUIPMENT;
      let viewKind: PidNodeKind = 'equipment';
      let stencilType: 'Equipment' | 'PipingComponent' | 'ProcessInstrument' = 'Equipment';

      if (item.elementType === 'PipingComponent') {
        styleName = STYLE_NAMES.VALVE;
        viewKind = 'pipingComponent';
        stencilType = 'PipingComponent';
      } else if (item.elementType === 'ProcessInstrument') {
        styleName = STYLE_NAMES.INSTRUMENT;
        viewKind = 'instrument';
        stencilType = 'ProcessInstrument';
      }

      const cell = this.graph.insertVertex(
        parent,
        nextId,
        tagName,
        x,
        y,
        item.defaultWidth,
        item.defaultHeight,
        {
          baseStyleNames: [styleName],
          shape: item.stencil || catalogStencilFor(stencilType, item.dexpiClass || item.componentClass),
        }
      );

      const meta: CellMetadata = {
        elementType: item.elementType,
        dexpiId: nextId,
        dexpiClass: item.dexpiClass || item.componentClass,
        viewKind,
        attributes: {},
      };
      (cell as any).dexpiMetadata = meta;

      if (item.elementType === 'Equipment') {
        const n1 = this.graph.insertVertex(
          cell,
          `${nextId}-N1`,
          'N1',
          0,
          0.5,
          8,
          8,
          { baseStyleNames: [STYLE_NAMES.NOZZLE] },
          true
        );
        (n1 as any).dexpiMetadata = {
          elementType: 'Nozzle',
          dexpiId: `${nextId}-N1`,
          dexpiClass: 'Nozzle',
          viewKind: 'nozzle',
          attributes: { ConnectionType: 'Inlet' },
        };

        const n2 = this.graph.insertVertex(
          cell,
          `${nextId}-N2`,
          'N2',
          1,
          0.5,
          8,
          8,
          { baseStyleNames: [STYLE_NAMES.NOZZLE] },
          true
        );
        (n2 as any).dexpiMetadata = {
          elementType: 'Nozzle',
          dexpiId: `${nextId}-N2`,
          dexpiClass: 'Nozzle',
          viewKind: 'nozzle',
          attributes: { ConnectionType: 'Outlet' },
        };
      }
    } finally {
      modelTransaction.endUpdate();
    }
  }

  public updateCellAttribute(cellId: string, property: string, value: string): void {
    const cell = this.graph.getDataModel().getCell(cellId);
    if (!cell) return;

    if (property === 'tagName') {
      this.graph.getDataModel().setValue(cell, value);
    }

    const meta = (cell as any).dexpiMetadata as CellMetadata | undefined;
    if (meta) {
      if (!meta.attributes) meta.attributes = {};
      if (property.startsWith('attr:')) {
        const attrName = property.replace('attr:', '');
        meta.attributes[attrName] = value;
      } else {
        meta.attributes[property] = value;
      }
    }

    const updated = this.adapter.graphToView(this.graph);
    this.callbacks.onModelChanged(updated);
    this.emitSelection(cell);
  }

  private viewportCentre(): Point {
    const rect = this.container.getBoundingClientRect();
    return this.graph.getPointForEvent({
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    } as MouseEvent);
  }

  private configureGraph(): void {
    // Interaction model: move + connect + pan. Technical symbols are never resized
    // and their labels come from the DEXPI tag, so both are disabled.
    this.graph.setConnectable(true);
    this.graph.setCellsMovable(true);
    this.graph.setCellsResizable(false);
    this.graph.setCellsEditable(false);
    this.graph.setDropEnabled(true);
    this.graph.setGridEnabled(true);
    this.graph.setGridSize(10);
    this.graph.setAllowDanglingEdges(false);
    this.graph.setMultigraph(true);

    // Smooth canvas panning: right-drag anywhere, or left-drag on empty canvas
    // (left-drag on a cell still moves it).
    this.graph.setPanning(true);
    const panning = this.graph.getPlugin<PanningHandler>('PanningHandler');
    if (panning) {
      panning.useLeftButtonForPanning = true;
      panning.ignoreCell = false;
      panning.usePopupTrigger = true;
    }
  }

  private bindEvents(): void {
    this.graph.getDataModel().addListener(InternalEvent.CHANGE, () => {
      if (this.isUpdatingInternally) return;
      const updated = this.adapter.graphToView(this.graph);
      this.callbacks.onModelChanged(updated);
    });

    this.graph.getSelectionModel().addListener(InternalEvent.CHANGE, () => {
      this.emitSelection(this.graph.getSelectionCell());
    });

    // Keep the spatial index in step with interactive structural edits. During a
    // full renderModel() the index is rebuilt wholesale, so skip the churn.
    const reindex = (_s: unknown, e: { getProperty(k: string): unknown }) => {
      if (this.isUpdatingInternally) return;
      this.spatialIndex.update((e.getProperty('cells') as Cell[]) ?? []);
      this.culling.schedule();
    };
    this.graph.addListener(InternalEvent.CELLS_MOVED, reindex);
    this.graph.addListener(InternalEvent.CELLS_RESIZED, reindex);
    this.graph.addListener(InternalEvent.CELLS_ADDED, reindex);
    this.graph.addListener(
      InternalEvent.CELLS_REMOVED,
      (_s: unknown, e: { getProperty(k: string): unknown }) => {
        if (this.isUpdatingInternally) return;
        this.spatialIndex.remove((e.getProperty('cells') as Cell[]) ?? []);
        this.culling.schedule();
      }
    );

    // Live zoom indicator.
    const view = this.graph.getView();
    const emitZoom = () => this.callbacks.onZoomChanged?.(view.scale);
    view.addListener(InternalEvent.SCALE, emitZoom);
    view.addListener(InternalEvent.SCALE_AND_TRANSLATE, emitZoom);

    // Protect cells that are being dragged / connected from viewport culling so
    // port detection and snapping never lose their target mid-gesture.
    const connectionHandler = this.graph.getPlugin<ConnectionHandler>('ConnectionHandler');
    connectionHandler?.addListener(InternalEvent.START, () => {
      this.culling.setProtected(this.graph.getSelectionCells());
    });
    connectionHandler?.addListener(InternalEvent.RESET, () => this.culling.setProtected(null));
    connectionHandler?.addListener(InternalEvent.CONNECT, () => this.culling.setProtected(null));

    this.container.addEventListener('pointerdown', (e) => {
      const rect = this.container.getBoundingClientRect();
      const hit = this.graph.getCellAt(e.clientX - rect.left, e.clientY - rect.top);
      if (!hit) return;
      this.culling.setProtected([...this.graph.getSelectionCells(), hit]);
    });
    const clearProtection = () => requestAnimationFrame(() => this.culling.setProtected(null));
    this.container.addEventListener('pointerup', clearProtection);
    this.container.addEventListener('pointercancel', clearProtection);

    this.container.addEventListener('pointermove', (e) => {
      this.lastPointerGraphPoint = this.graph.getPointForEvent({
        clientX: e.clientX,
        clientY: e.clientY,
      } as MouseEvent);
    });

    this.container.addEventListener(
      'wheel',
      (e) => {
        if (!e.ctrlKey && !e.metaKey) return;
        e.preventDefault();
        if (e.deltaY < 0) this.graph.zoomIn();
        else this.graph.zoomOut();
      },
      { passive: false }
    );

    window.addEventListener('keydown', (e) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const cells = this.graph.getSelectionCells();
        if (cells && cells.length > 0) this.graph.removeCells(cells, true);
      } else if ((e.ctrlKey || e.metaKey) && (e.key === '0' || e.key === ')')) {
        e.preventDefault();
        this.zoomFit();
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && (e.key === 'g' || e.key === 'G')) {
        e.preventDefault();
        this.toggleGrid();
      }
    });
  }

  private emitSelection(cell: Cell | null): void {
    if (!cell) {
      this.callbacks.onSelectionChanged(null);
      return;
    }
    const meta = (cell as unknown as { dexpiMetadata?: Record<string, unknown> }).dexpiMetadata ?? {};
    const rawAttrs = (meta.attributes as Record<string, unknown>) ?? {};
    const attributes: SelectionInfo['attributes'] = {};
    for (const [k, v] of Object.entries(rawAttrs)) {
      if (typeof v === 'object' && v !== null && 'value' in v) {
        attributes[k] = { value: String((v as any).value ?? ''), units: (v as any).units };
      } else {
        attributes[k] = { value: String(v ?? '') };
      }
    }
    this.callbacks.onSelectionChanged({
      id: cell.id ?? '',
      elementType: String(meta.elementType ?? (cell.isEdge() ? 'Pipeline' : 'Component')),
      componentClass: String(meta.dexpiClass ?? 'Unknown'),
      tagName: typeof cell.value === 'string' ? cell.value : cell.id ?? '',
      isEdge: cell.isEdge() ?? false,
      attributes,
    });
  }

}

function readThemeTokens(container: HTMLElement): PidStyleTokens {
  const cs = getComputedStyle(container);
  const read = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return {
    stroke: read('--pid-stroke', '#1b1b1b'),
    fill: read('--pid-fill', '#ffffff'),
    font: read('--pid-font', '#1b1b1b'),
    instrumentFill: read('--pid-instrument-fill', '#ffffff'),
    fontFamily: read('--pid-font-family', 'Helvetica, Arial, "Segoe UI", sans-serif'),
  };
}

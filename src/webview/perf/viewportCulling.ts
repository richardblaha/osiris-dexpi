import { Cell, Graph, InternalEvent } from '@maxgraph/core';
import { SpatialIndexManager } from './spatialIndex';

export interface CullingOptions {
  /** Extra margin (screen px) kept rendered around the viewport to avoid flicker. */
  bufferPx?: number;
  /** Culling stays off until the graph has at least this many indexed cells. */
  minCells?: number;
}

/**
 * Viewport virtualization: hides cells whose bounding box falls outside the
 * (buffered) viewport so the browser can drop them from layout / paint.
 *
 * Hiding is done with `display: none` on the cell's SVG group rather than by
 * removing cells from the model — the maxGraph model stays complete and
 * authoritative at all times.
 */
export class ViewportCullingController {
  private readonly bufferPx: number;
  private readonly minCells: number;
  private hidden = new Set<string>();
  private frame = 0;
  private protectedIds: Set<string> | null = null;
  private disposed = false;

  private readonly onViewChange = () => this.schedule();

  constructor(
    private readonly graph: Graph,
    private readonly container: HTMLElement,
    private readonly index: SpatialIndexManager,
    options: CullingOptions = {}
  ) {
    this.bufferPx = options.bufferPx ?? 280;
    this.minCells = options.minCells ?? 200;
  }

  public start(): void {
    const view = this.graph.getView();
    view.addListener(InternalEvent.SCALE, this.onViewChange);
    view.addListener(InternalEvent.TRANSLATE, this.onViewChange);
    view.addListener(InternalEvent.SCALE_AND_TRANSLATE, this.onViewChange);
    window.addEventListener('resize', this.onViewChange);
    this.refresh();
  }

  public dispose(): void {
    this.disposed = true;
    const view = this.graph.getView();
    view.removeListener(this.onViewChange);
    window.removeEventListener('resize', this.onViewChange);
    if (this.frame) cancelAnimationFrame(this.frame);
    this.showAll();
  }

  /** Call after a full re-render so freshly created nodes get culled immediately. */
  public schedule(): void {
    if (this.disposed || this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.refresh();
    });
  }

  /**
   * Interactive-edit guard: keeps the given cells and their direct neighbours
   * rendered no matter where they are, so port detection / snapping never sees
   * a culled target mid-drag. Pass `null` to lift the guard.
   */
  public setProtected(cells: Cell[] | null): void {
    if (!cells) {
      this.protectedIds = null;
    } else {
      const ids = new Set<string>();
      for (const cell of cells) {
        if (!cell?.id) continue;
        ids.add(cell.id);
        for (const edge of cell.edges ?? []) {
          if (edge.id) ids.add(edge.id);
          const src = edge.getTerminal(true);
          const other = src && src !== cell ? src : edge.getTerminal(false);
          if (other?.id) ids.add(other.id);
        }
      }
      this.protectedIds = ids;
    }
    this.refresh();
  }

  private refresh(): void {
    if (this.disposed) return;
    if (this.index.size < this.minCells) {
      this.showAll();
      return;
    }

    const region = this.viewportRegion();
    const visible = this.index.queryIds(region);

    // Edge retention: an edge survives if it intersects the viewport OR either
    // of its endpoints is visible.
    const parent = this.graph.getDefaultParent();
    for (const cell of parent.children ?? []) {
      if (!cell.isEdge() || !cell.id || visible.has(cell.id)) continue;
      const s = cell.getTerminal(true);
      const t = cell.getTerminal(false);
      if ((s?.id && visible.has(s.id)) || (t?.id && visible.has(t.id))) visible.add(cell.id);
    }

    for (const cell of parent.children ?? []) {
      const id = cell.id;
      if (!id) continue;
      const keep = visible.has(id) || (this.protectedIds?.has(id) ?? false);
      this.setCellVisible(cell, keep);
    }
  }

  private viewportRegion(): { minX: number; minY: number; maxX: number; maxY: number } {
    const view = this.graph.getView();
    const scale = view.scale || 1;
    const tx = view.translate.x;
    const ty = view.translate.y;
    const rect = this.container.getBoundingClientRect();
    const buf = this.bufferPx;

    // screen = (model + translate) * scale  =>  model = screen / scale - translate
    return {
      minX: -buf / scale - tx,
      minY: -buf / scale - ty,
      maxX: (rect.width + buf) / scale - tx,
      maxY: (rect.height + buf) / scale - ty,
    };
  }

  private setCellVisible(cell: Cell, visible: boolean): void {
    const id = cell.id!;
    const isHidden = this.hidden.has(id);
    if (visible === !isHidden) return;

    const state = this.graph.getView().getState(cell);
    const nodes = [state?.shape?.node, state?.text?.node].filter(Boolean) as SVGElement[];
    for (const node of nodes) node.style.display = visible ? '' : 'none';

    if (visible) this.hidden.delete(id);
    else this.hidden.add(id);
  }

  private showAll(): void {
    if (this.hidden.size === 0) return;
    for (const id of this.hidden) {
      const cell = this.graph.getDataModel().getCell(id);
      if (!cell) continue;
      const state = this.graph.getView().getState(cell);
      for (const node of [state?.shape?.node, state?.text?.node]) {
        if (node) (node as SVGElement).style.display = '';
      }
    }
    this.hidden.clear();
  }
}

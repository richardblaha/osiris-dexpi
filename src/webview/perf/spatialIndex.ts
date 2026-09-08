import RBush from 'rbush';
import { Cell, Graph } from '@maxgraph/core';

/** One R-tree entry: an axis-aligned bounding box in *graph model* coordinates. */
export interface CellBBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  cellId: string;
  isEdge: boolean;
}

/**
 * Spatial index over every top-level cell, backed by RBush.
 *
 * Coordinates are the un-scaled / un-translated model coordinates so the tree
 * stays valid across pan and zoom — the viewport is converted into the same
 * space before querying (see {@link ViewportCullingController}).
 */
export class SpatialIndexManager {
  private tree = new RBush<CellBBox>();
  private byId = new Map<string, CellBBox>();

  constructor(private readonly graph: Graph) {}

  /** Wipes and bulk-loads the index from the current graph — use after a full render. */
  public rebuild(): void {
    this.tree.clear();
    this.byId.clear();

    const parent = this.graph.getDefaultParent();
    const entries: CellBBox[] = [];
    for (const cell of parent.children ?? []) {
      const box = this.computeBBox(cell);
      if (!box) continue;
      entries.push(box);
      this.byId.set(box.cellId, box);
    }
    this.tree.load(entries);
  }

  /** Re-indexes a set of cells after a move / resize / waypoint edit. */
  public update(cells: Cell[]): void {
    for (const cell of cells) {
      if (!cell?.id) continue;
      this.removeById(cell.id);
      const box = this.computeBBox(cell);
      if (!box) continue;
      this.tree.insert(box);
      this.byId.set(box.cellId, box);

      // A moved vertex drags its connected edges — keep their boxes fresh too.
      if (cell.isVertex()) {
        for (const edge of cell.edges ?? []) this.update([edge]);
      }
    }
  }

  public remove(cells: Cell[]): void {
    for (const cell of cells) {
      if (cell?.id) this.removeById(cell.id);
    }
  }

  /** Cell ids whose bounding box intersects the given model-space region. */
  public queryIds(region: { minX: number; minY: number; maxX: number; maxY: number }): Set<string> {
    const ids = new Set<string>();
    for (const hit of this.tree.search(region)) ids.add(hit.cellId);
    return ids;
  }

  public getBBox(cellId: string): CellBBox | undefined {
    return this.byId.get(cellId);
  }

  public get size(): number {
    return this.byId.size;
  }

  private removeById(cellId: string): void {
    const existing = this.byId.get(cellId);
    if (!existing) return;
    this.tree.remove(existing, (a, b) => a.cellId === b.cellId);
    this.byId.delete(cellId);
  }

  private computeBBox(cell: Cell): CellBBox | null {
    if (!cell?.id) return null;

    if (cell.isEdge()) {
      const pts: Array<{ x: number; y: number }> = [];
      const geo = cell.getGeometry();
      const source = cell.getTerminal(true);
      const target = cell.getTerminal(false);
      const sBox = source ? this.byId.get(source.id ?? '') ?? this.computeBBox(source) : null;
      const tBox = target ? this.byId.get(target.id ?? '') ?? this.computeBBox(target) : null;
      if (sBox) pts.push({ x: (sBox.minX + sBox.maxX) / 2, y: (sBox.minY + sBox.maxY) / 2 });
      if (tBox) pts.push({ x: (tBox.minX + tBox.maxX) / 2, y: (tBox.minY + tBox.maxY) / 2 });
      if (geo?.sourcePoint) pts.push(geo.sourcePoint);
      if (geo?.targetPoint) pts.push(geo.targetPoint);
      for (const p of geo?.points ?? []) pts.push(p);
      if (pts.length === 0) return null;

      return {
        minX: Math.min(...pts.map((p) => p.x)),
        minY: Math.min(...pts.map((p) => p.y)),
        maxX: Math.max(...pts.map((p) => p.x)),
        maxY: Math.max(...pts.map((p) => p.y)),
        cellId: cell.id,
        isEdge: true,
      };
    }

    const geo = cell.getGeometry();
    if (!geo) return null;
    return {
      minX: geo.x,
      minY: geo.y,
      maxX: geo.x + geo.width,
      maxY: geo.y + geo.height,
      cellId: cell.id,
      isEdge: false,
    };
  }
}

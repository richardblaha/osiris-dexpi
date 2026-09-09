/**
 * Spatial Culling Controller
 *
 * Coordinates Viewport Culling queries against PackedRTree with safe margin buffering
 * to eliminate edge pop-in during panning and zooming.
 */

import { PackedRTree } from './packedRTree';
import type { CameraState } from '../types';

export interface CullingOptions {
  marginPx?: number;
  initialCapacity?: number;
}

export class SpatialCullingController {
  private readonly tree: PackedRTree;
  private readonly marginPx: number;
  private visibleIndices: Uint32Array;

  constructor(options: CullingOptions = {}) {
    this.tree = new PackedRTree(16);
    this.marginPx = options.marginPx ?? 150;
    this.visibleIndices = new Uint32Array(options.initialCapacity ?? 65536);
  }

  /**
   * Rebuilds the packed spatial index from raw bounding boxes [minX, minY, maxX, maxY].
   */
  public buildIndex(boxes: Float32Array, ids?: Uint32Array): void {
    const itemCount = (boxes.length / 4) | 0;
    if (this.visibleIndices.length < itemCount) {
      this.visibleIndices = new Uint32Array(itemCount);
    }
    this.tree.load(boxes, ids);
  }

  /**
   * Queries visible entities for the given camera state.
   * Returns a sub-slice of visibleIndices containing the matching IDs.
   */
  public queryVisible(camera: CameraState): Uint32Array {
    const { x, y, zoom, viewportWidth, viewportHeight } = camera;

    const safeZoom = Math.max(zoom, 0.001);
    const halfW = viewportWidth / (2 * safeZoom);
    const halfH = viewportHeight / (2 * safeZoom);
    const marginWorld = this.marginPx / safeZoom;

    const minX = x - halfW - marginWorld;
    const maxX = x + halfW + marginWorld;
    const minY = y - halfH - marginWorld;
    const maxY = y + halfH + marginWorld;

    const matchCount = this.tree.search(minX, minY, maxX, maxY, this.visibleIndices);
    return this.visibleIndices.subarray(0, matchCount);
  }

  public get totalIndexed(): number {
    return this.tree.size;
  }
}


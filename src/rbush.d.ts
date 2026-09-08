/**
 * Minimal ambient types for `rbush` v4 (ships no `.d.ts`).
 * Covers only the surface the SpatialIndexManager uses.
 */
declare module 'rbush' {
  export interface BBox {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }

  export default class RBush<T = BBox> {
    constructor(maxEntries?: number);
    insert(item: T): this;
    load(items: ReadonlyArray<T>): this;
    remove(item: T, equals?: (a: T, b: T) => boolean): this;
    clear(): this;
    search(bbox: BBox): T[];
    all(): T[];
    collides(bbox: BBox): boolean;
  }
}

/**
 * Zero-Allocation Hilbert Packed R-Tree
 *
 * Implements a static R-Tree stored in flat TypedArrays (Float32Array boxes, Uint32Array indices)
 * bulk-loaded via Hilbert curve ordering.
 * Guarantees zero memory allocation during spatial viewport queries.
 */

export interface BoundingBox2D {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export class PackedRTree {
  private readonly nodeSize: number;
  private numItems = 0;
  private numNodes = 0;

  // Level offsets in the flat array
  private levelBounds: number[] = [];

  // Flat storage: each node has 4 floats [minX, minY, maxX, maxY]
  private boxes!: Float32Array;
  // Leaf items point to entityId; internal nodes point to child node index
  private indices!: Uint32Array;

  // Reusable search stack for zero-allocation query execution
  private searchStack = new Int32Array(256);

  constructor(nodeSize = 16) {
    this.nodeSize = Math.max(4, Math.min(64, nodeSize));
  }

  /**
   * Bulk loads elements into the packed R-tree.
   * boxes: Flat array of [minX, minY, maxX, maxY] per element
   * ids: Array of entity IDs (or indices 0..N-1)
   */
  public load(boxesInput: Float32Array, idsInput?: Uint32Array): void {
    const numItems = (boxesInput.length / 4) | 0;
    this.numItems = numItems;

    if (numItems === 0) {
      this.boxes = new Float32Array(0);
      this.indices = new Uint32Array(0);
      this.numNodes = 0;
      return;
    }

    // 1. Calculate bounding extent of the entire dataset
    let extentMinX = Infinity;
    let extentMinY = Infinity;
    let extentMaxX = -Infinity;
    let extentMaxY = -Infinity;

    for (let i = 0; i < numItems; i++) {
      const b = i * 4;
      if (boxesInput[b + 0] < extentMinX) extentMinX = boxesInput[b + 0];
      if (boxesInput[b + 1] < extentMinY) extentMinY = boxesInput[b + 1];
      if (boxesInput[b + 2] > extentMaxX) extentMaxX = boxesInput[b + 2];
      if (boxesInput[b + 3] > extentMaxY) extentMaxY = boxesInput[b + 3];
    }

    const extentW = Math.max(extentMaxX - extentMinX, 0.0001);
    const extentH = Math.max(extentMaxY - extentMinY, 0.0001);

    // 2. Compute Hilbert values for leaf centroids
    const hilbertValues = new Uint32Array(numItems);
    const sortedIndices = new Uint32Array(numItems);

    for (let i = 0; i < numItems; i++) {
      const b = i * 4;
      const cx = (boxesInput[b + 0] + boxesInput[b + 2]) * 0.5;
      const cy = (boxesInput[b + 1] + boxesInput[b + 3]) * 0.5;

      const normX = Math.floor(((cx - extentMinX) / extentW) * 32767);
      const normY = Math.floor(((cy - extentMinY) / extentH) * 32767);

      hilbertValues[i] = this.hilbert16(
        Math.max(0, Math.min(32767, normX)),
        Math.max(0, Math.min(32767, normY))
      );
      sortedIndices[i] = i;
    }

    // 3. Sort item indices by Hilbert curve value
    this.quickSortHilbert(hilbertValues, sortedIndices, 0, numItems - 1);

    // 4. Calculate tree levels and total node count
    const levelCounts: number[] = [];
    let count = numItems;
    levelCounts.push(count);

    while (count > this.nodeSize) {
      count = Math.ceil(count / this.nodeSize);
      levelCounts.push(count);
    }

    let totalNodes = 0;
    this.levelBounds = [];
    for (let l = 0; l < levelCounts.length; l++) {
      this.levelBounds.push(totalNodes);
      totalNodes += levelCounts[l];
    }
    this.numNodes = totalNodes;

    this.boxes = new Float32Array(totalNodes * 4);
    this.indices = new Uint32Array(totalNodes);

    // 5. Populate leaf nodes (Level 0) in sorted Hilbert order
    for (let i = 0; i < numItems; i++) {
      const origIdx = sortedIndices[i];
      const srcOffset = origIdx * 4;
      const dstOffset = i * 4;

      this.boxes[dstOffset + 0] = boxesInput[srcOffset + 0];
      this.boxes[dstOffset + 1] = boxesInput[srcOffset + 1];
      this.boxes[dstOffset + 2] = boxesInput[srcOffset + 2];
      this.boxes[dstOffset + 3] = boxesInput[srcOffset + 3];

      this.indices[i] = idsInput ? idsInput[origIdx] : origIdx;
    }

    // 6. Build upper tree levels bottom-up
    for (let l = 0; l < levelCounts.length - 1; l++) {
      const childLevelStart = this.levelBounds[l];
      const childCount = levelCounts[l];
      const parentLevelStart = this.levelBounds[l + 1];
      const parentCount = levelCounts[l + 1];

      for (let p = 0; p < parentCount; p++) {
        const childStart = childLevelStart + p * this.nodeSize;
        const childEnd = Math.min(childStart + this.nodeSize, childLevelStart + childCount);

        let pMinX = Infinity;
        let pMinY = Infinity;
        let pMaxX = -Infinity;
        let pMaxY = -Infinity;

        for (let c = childStart; c < childEnd; c++) {
          const cb = c * 4;
          if (this.boxes[cb + 0] < pMinX) pMinX = this.boxes[cb + 0];
          if (this.boxes[cb + 1] < pMinY) pMinY = this.boxes[cb + 1];
          if (this.boxes[cb + 2] > pMaxX) pMaxX = this.boxes[cb + 2];
          if (this.boxes[cb + 3] > pMaxY) pMaxY = this.boxes[cb + 3];
        }

        const pb = (parentLevelStart + p) * 4;
        this.boxes[pb + 0] = pMinX;
        this.boxes[pb + 1] = pMinY;
        this.boxes[pb + 2] = pMaxX;
        this.boxes[pb + 3] = pMaxY;

        // Parent index points to its first child index in the flat array
        this.indices[parentLevelStart + p] = childStart;
      }
    }
  }

  /**
   * Queries bounding box intersection.
   * Writes matching entity IDs into outBuffer.
   * Returns the count of matching items.
   */
  public search(
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
    outBuffer: Uint32Array
  ): number {
    if (this.numItems === 0) return 0;

    let matchCount = 0;
    const maxCapacity = outBuffer.length;

    let stackPtr = 0;
    const rootLevel = this.levelBounds.length - 1;
    const rootLevelStart = this.levelBounds[rootLevel];
    const rootLevelEnd = this.numNodes;

    // Push all root nodes onto stack
    for (let r = rootLevelStart; r < rootLevelEnd; r++) {
      this.searchStack[stackPtr++] = r;
      this.searchStack[stackPtr++] = rootLevel;
    }

    while (stackPtr > 0) {
      const level = this.searchStack[--stackPtr];
      const nodeIdx = this.searchStack[--stackPtr];

      const b = nodeIdx * 4;
      // Fast AABB intersection test
      if (
        maxX < this.boxes[b + 0] ||
        minX > this.boxes[b + 2] ||
        maxY < this.boxes[b + 1] ||
        minY > this.boxes[b + 3]
      ) {
        continue;
      }

      if (level === 0) {
        // Leaf node reached!
        if (matchCount < maxCapacity) {
          outBuffer[matchCount++] = this.indices[nodeIdx];
        }
      } else {
        // Internal node: unpack children
        const childStart = this.indices[nodeIdx];
        const childLevel = level - 1;
        const nextLevelStart =
          childLevel + 1 < this.levelBounds.length ? this.levelBounds[childLevel + 1] : this.numNodes;
        const childEnd = Math.min(childStart + this.nodeSize, nextLevelStart);

        for (let c = childStart; c < childEnd; c++) {
          if (stackPtr + 2 >= this.searchStack.length) {
            // Expand stack if needed (rare for depth <= 8)
            const newStack = new Int32Array(this.searchStack.length * 2);
            newStack.set(this.searchStack);
            this.searchStack = newStack;
          }
          this.searchStack[stackPtr++] = c;
          this.searchStack[stackPtr++] = childLevel;
        }
      }
    }

    return matchCount;
  }

  public get size(): number {
    return this.numItems;
  }

  private hilbert16(x: number, y: number): number {
    let d = 0;
    for (let s = 1 << 14; s > 0; s >>= 1) {
      const rx = (x & s) > 0 ? 1 : 0;
      const ry = (y & s) > 0 ? 1 : 0;
      d += s * s * ((3 * rx) ^ ry);
      if (ry === 0) {
        if (rx === 1) {
          x = s * 2 - 1 - x;
          y = s * 2 - 1 - y;
        }
        const t = x;
        x = y;
        y = t;
      }
    }
    return d >>> 0;
  }

  private quickSortHilbert(
    values: Uint32Array,
    indices: Uint32Array,
    left: number,
    right: number
  ): void {
    if (left >= right) return;

    const pivot = values[(left + right) >> 1];
    let i = left;
    let j = right;

    while (i <= j) {
      while (values[i] < pivot) i++;
      while (values[j] > pivot) j--;
      if (i <= j) {
        const tempVal = values[i];
        values[i] = values[j];
        values[j] = tempVal;

        const tempIdx = indices[i];
        indices[i] = indices[j];
        indices[j] = tempIdx;

        i++;
        j--;
      }
    }

    this.quickSortHilbert(values, indices, left, j);
    this.quickSortHilbert(values, indices, i, right);
  }
}


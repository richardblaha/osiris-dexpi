/**
 * Model traversal and ID index resolution utilities.
 */

import type { DexpiObject } from './classes/base';
import type { DexpiModel } from './classes/dexpiModel';

export interface IndexEntry {
  obj: DexpiObject;
  parent?: DexpiObject;
  field?: string;
  path: string[];
}

export type WalkVisitor = (entry: IndexEntry) => void | boolean;

function isDexpiObject(val: unknown): val is DexpiObject {
  return (
    typeof val === 'object' &&
    val !== null &&
    'id' in val &&
    typeof (val as any).id === 'string' &&
    'uri' in val &&
    typeof (val as any).uri === 'string'
  );
}

/**
 * Recursively walks all DexpiObjects in a DexpiModel.
 * If visitor returns false, traversal into children of that object is skipped.
 */
export function walkModel(model: DexpiModel, visitor: WalkVisitor): void {
  const visited = new Set<string>();

  function walk(
    current: unknown,
    parent?: DexpiObject,
    field?: string,
    currentPath: string[] = []
  ): void {
    if (!current || typeof current !== 'object') return;

    if (Array.isArray(current)) {
      for (let i = 0; i < current.length; i++) {
        walk(current[i], parent, field, [...currentPath, String(i)]);
      }
      return;
    }

    if (isDexpiObject(current)) {
      if (visited.has(current.id)) return;
      visited.add(current.id);

      const continueDeeper = visitor({
        obj: current,
        parent,
        field,
        path: currentPath,
      });

      if (continueDeeper === false) return;

      for (const [k, v] of Object.entries(current)) {
        if (k === '_proteus' || k === 'parent' || k === 'attributes') continue;
        walk(v, current, k, [...currentPath, k]);
      }
    } else {
      for (const [k, v] of Object.entries(current)) {
        if (k === '_proteus' || k === 'parent' || k === 'attributes') continue;
        walk(v, parent, field || k, [...currentPath, k]);
      }
    }
  }

  walk(model, undefined, undefined, ['root']);
}

/**
 * Builds a lookup map of all DexpiObjects keyed by their ID.
 */
export function resolveIndex(model: DexpiModel): Map<string, IndexEntry> {
  const index = new Map<string, IndexEntry>();
  walkModel(model, (entry) => {
    index.set(entry.obj.id, entry);
  });
  return index;
}


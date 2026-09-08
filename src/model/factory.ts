/**
 * Factory for creating DEXPI domain objects with standard IDs and URIs.
 */

import { uriForClass } from './uris';
import type { DexpiObject } from './classes/base';

export function makeUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function make<T extends DexpiObject = DexpiObject>(
  dexpiClass: string,
  partial?: Partial<T>
): T {
  const id = partial?.id || makeUuid();
  const uri = partial?.uri || uriForClass(dexpiClass);
  const result = {
    id,
    uri,
    dexpiClass,
    ...partial,
  } as unknown as T;
  return result;
}


/**
 * Proteus <Association> tag parser.
 */

import type { RawNode } from '../raw';
import { childrenNamed } from '../raw';

export interface AssociationEntry {
  type: string;
  itemId: string;
  sourceProteusId: string;
}

export function parseAssociations(node: RawNode, sourceProteusId: string): AssociationEntry[] {
  const assocNodes = childrenNamed(node, 'Association');
  return assocNodes.map((a) => ({
    type: a.attrs.Type || '',
    itemId: a.attrs.ItemID || '',
    sourceProteusId,
  }));
}


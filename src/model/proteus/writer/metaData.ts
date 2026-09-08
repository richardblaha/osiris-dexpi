/**
 * MetaData serializer for Proteus XML.
 */

import type { MetaData } from '../../classes/metaData';
import type { RawNode } from '../raw';
import { makeRawNode, isRawNode } from '../raw';
import { buildGenericAttributesNode } from './genericAttributes';

export function buildMetaDataNode(metaData: MetaData): RawNode {
  const id = metaData.proteusId || metaData.id || 'MetaData-1';

  const attrs: Record<string, string> = {
    ...(metaData._proteus ? metaData._proteus.attrs : {}),
    ID: id,
    ComponentClass: 'MetaData',
    ComponentClassURI: 'http://sandbox.dexpi.org/rdl/MetaData',
  };

  const children: RawNode[] = [];
  if (metaData._proteus && Array.isArray(metaData._proteus.extra)) {
    for (const child of metaData._proteus.extra) {
      if (isRawNode(child) && child.tag !== 'GenericAttributes') {
        children.push(child);
      }
    }
  }

  const genAttrs = buildGenericAttributesNode(metaData, 'MetaData');
  if (genAttrs) {
    children.push(genAttrs);
  }

  return makeRawNode('MetaData', attrs, children);
}


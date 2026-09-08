/**
 * MetaData reader for Proteus XML.
 */

import { make } from '../../factory';
import type { MetaData } from '../../classes/metaData';
import type { RawNode } from '../raw';
import { parseGenericAttributeSets } from './genericAttributes';
import type { ParseContext } from '../core';

export function parseMetaData(node: RawNode, ctx: ParseContext): MetaData {
  const proteusId = node.attrs.ID || 'MetaData-1';
  const componentClass = node.attrs.ComponentClass || 'MetaData';

  const { typedAttributes, customAttributes } = parseGenericAttributeSets(node, 'MetaData');

  const metaData = make<MetaData>('MetaData', {
    proteusId,
    ...typedAttributes,
    customAttributes,
    _proteus: {
      attrs: { ...node.attrs },
      extra: [...node.children],
      childOrder: node.children.map((c) => (typeof c === 'string' ? '#text' : c.tag)),
    },
  });

  ctx.objectRegistry.register(metaData, proteusId);
  return metaData;
}


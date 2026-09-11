/**
 * Equipment, Nozzle, Chamber reader for Proteus XML.
 */

import { make } from '../../factory';
import { rdlUriForClass } from '../rdl';
import type { Equipment, Nozzle, Chamber, PipingNode } from '../../classes/equipment';
import type { RawNode } from '../raw';
import { childNamed, childrenNamed } from '../raw';
import { parseGenericAttributeSets } from './genericAttributes';
import { parsePosition, parseExtent, parseScale } from './geometry';
import type { ParseContext } from '../core';

export function parseNozzle(node: RawNode, parentEquipmentId: string, ctx: ParseContext): Nozzle {
  const proteusId = node.attrs.ID || `Nozzle-${Date.now()}`;
  const componentClass = node.attrs.ComponentClass || 'Nozzle';

  let subTagName = node.attrs.TagName || node.attrs.SubTagName;
  const labelNode = childNamed(node, 'Label');
  if (labelNode) {
    const textNode = childNamed(labelNode, 'Text');
    if (textNode && textNode.attrs.String) {
      subTagName = textNode.attrs.String;
    }
  }

  // Parse ConnectionPoints -> Node
  const nodes: PipingNode[] = [];
  const connPointsNode = childNamed(node, 'ConnectionPoints');
  if (connPointsNode) {
    const nodeElements = childrenNamed(connPointsNode, 'Node');
    for (const ne of nodeElements) {
      const type = ne.attrs.Type;
      if (type === 'process' || type === 'pipingNode' || (!type && nodeElements.length === 1)) {
        const nodeProteusId = ne.attrs.ID || `PipingNode-${Date.now()}`;
        const pipingNode = make<PipingNode>('PipingNode', {
          proteusId: nodeProteusId,
          nodeType: type || 'process',
          position: parsePosition(ne) || parsePosition(node),
        });
        ctx.objectRegistry.register(pipingNode, nodeProteusId);
        nodes.push(pipingNode);
      }
    }
  }

  // Fallback: if no nodes declared, create at least 1 default PipingNode for the nozzle
  if (nodes.length === 0) {
    const defaultNodeId = `${proteusId}-Node-1`;
    const defaultNode = make<PipingNode>('PipingNode', {
      proteusId: defaultNodeId,
      nodeType: 'pipingNode',
      position: parsePosition(node),
    });
    ctx.objectRegistry.register(defaultNode, defaultNodeId);
    nodes.push(defaultNode);
  }

  const { typedAttributes, customAttributes } = parseGenericAttributeSets(node, 'Nozzle');
  const pos = parsePosition(node);

  const nozzle = make<Nozzle>('Nozzle', {
    proteusId,
    subTagName,
    nodes,
    customAttributes,
    ...typedAttributes,
    _proteus: {
      attrs: { ...node.attrs },
      extra: [...node.children],
      childOrder: node.children.map((c) => (typeof c === 'string' ? '#text' : c.tag)),
    },
  });

  ctx.objectRegistry.register(nozzle, proteusId);
  return nozzle;
}

export function parseChamber(node: RawNode, ctx: ParseContext): Chamber {
  const proteusId = node.attrs.ID || `Chamber-${Date.now()}`;
  const { typedAttributes, customAttributes } = parseGenericAttributeSets(node, 'Chamber');

  const chamber = make<Chamber>('Chamber', {
    proteusId,
    customAttributes,
    ...typedAttributes,
    _proteus: {
      attrs: { ...node.attrs },
      extra: [...node.children],
      childOrder: node.children.map((c) => (typeof c === 'string' ? '#text' : c.tag)),
    },
  });

  ctx.objectRegistry.register(chamber, proteusId);
  return chamber;
}

export function parseEquipment(node: RawNode, ctx: ParseContext): Equipment {
  const proteusId = node.attrs.ID || `Equipment-${Date.now()}`;
  const dexpiClass = node.attrs.ComponentClass || 'Equipment';
  const componentClassUri = node.attrs.ComponentClassURI || rdlUriForClass(dexpiClass);

  let tagName = node.attrs.TagName;
  const labels = childrenNamed(node, 'Label');
  for (const label of labels) {
    if (label.attrs.ComponentClass === 'EquipmentTagNameLabel' || !tagName) {
      const textNode = childNamed(label, 'Text');
      if (textNode && textNode.attrs.String) {
        tagName = textNode.attrs.String;
      }
    }
  }

  const position = parsePosition(node);
  const extent = parseExtent(node);
  const scale = parseScale(node);

  const nozzleNodes = childrenNamed(node, 'Nozzle');
  const nozzles = nozzleNodes.map((n) => parseNozzle(n, proteusId, ctx));

  const chamberNodes = childrenNamed(node, 'Chamber');
  const chambers = chamberNodes.map((c) => parseChamber(c, ctx));

  const { typedAttributes, customAttributes } = parseGenericAttributeSets(node, dexpiClass);

  const equipment = make<Equipment>(dexpiClass, {
    proteusId,
    dexpiClass,
    componentClassUri,
    tagName: tagName || proteusId,
    position,
    extent,
    scale,
    componentName: node.attrs.ComponentName,
    nozzles,
    chambers,
    attributes: typedAttributes,
    customAttributes,
    _proteus: {
      attrs: { ...node.attrs },
      extra: [...node.children],
      childOrder: node.children.map((c) => (typeof c === 'string' ? '#text' : c.tag)),
    },
  });

  ctx.objectRegistry.register(equipment, proteusId);
  return equipment;
}

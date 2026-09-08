/**
 * Equipment, Nozzle, and Chamber serializer for Proteus XML.
 */

import { rdlUriForClass } from '../rdl';
import type { Equipment, Nozzle, Chamber, PipingNode } from '../../classes/equipment';
import type { RawNode } from '../raw';
import { makeRawNode, isRawNode, childNamed } from '../raw';
import { buildGenericAttributesNode } from './genericAttributes';
import { buildPositionNode, buildExtentNode } from './geometry';

export function updateLabelText(labelNode: RawNode, newText: string): RawNode {
  const newChildren = labelNode.children.map((c) => {
    if (isRawNode(c) && c.tag === 'Text') {
      return {
        ...c,
        attrs: {
          ...c.attrs,
          String: newText,
        },
      };
    }
    return c;
  });
  return {
    ...labelNode,
    children: newChildren,
  };
}

export function buildConnectionPointsNode(
  nodes: PipingNode[],
  existingNode?: RawNode
): RawNode {
  const nodeChildren: RawNode[] = [];
  for (const n of nodes) {
    const nAttrs: Record<string, string> = {
      ID: n.proteusId || n.id,
      Type: n.nodeType || 'process',
    };
    const nodeElemChildren: RawNode[] = [];
    if (n.position) {
      const posNode = buildPositionNode(n.position);
      if (posNode) nodeElemChildren.push(posNode);
    }
    nodeChildren.push(makeRawNode('Node', nAttrs, nodeElemChildren));
  }

  const attrs: Record<string, string> = {
    ...(existingNode ? existingNode.attrs : {}),
    NumPoints: String(nodes.length),
  };

  return makeRawNode('ConnectionPoints', attrs, nodeChildren);
}

export function buildNozzleNode(nozzle: Nozzle): RawNode {
  const id = nozzle.proteusId || nozzle.id;
  const dexpiClass = nozzle.dexpiClass || 'Nozzle';
  const componentClassUri = nozzle.componentClassUri || rdlUriForClass(dexpiClass) || 'http://data.posccaesar.org/rdl/RDS415214';

  const attrs: Record<string, string> = {
    ...(nozzle._proteus ? nozzle._proteus.attrs : {}),
    ID: id,
    ComponentClass: dexpiClass,
    ComponentClassURI: componentClassUri,
  };
  if (nozzle.subTagName) {
    if (attrs.SubTagName) attrs.SubTagName = nozzle.subTagName;
    else attrs.TagName = nozzle.subTagName;
  }
  if (!attrs.ComponentName) {
    attrs.ComponentName = 'NOZZLE_SHAPE';
  }

  const children: RawNode[] = [];
  const handled = new Set<string>();

  if (nozzle._proteus && Array.isArray(nozzle._proteus.extra)) {
    for (const child of nozzle._proteus.extra) {
      if (!isRawNode(child)) continue;

      if (child.tag === 'Position') {
        const posNode = buildPositionNode(nozzle.position, child);
        if (posNode) children.push(posNode);
        handled.add('Position');
      } else if (child.tag === 'ConnectionPoints') {
        children.push(buildConnectionPointsNode(nozzle.nodes || [], child));
        handled.add('ConnectionPoints');
      } else if (child.tag === 'Label') {
        if (nozzle.subTagName) {
          children.push(updateLabelText(child, nozzle.subTagName));
        } else {
          children.push(child);
        }
        handled.add('Label');
      } else if (child.tag === 'GenericAttributes') {
        // Handled after
      } else {
        children.push(child);
      }
    }
  }

  if (!handled.has('Position') && nozzle.position) {
    const posNode = buildPositionNode(nozzle.position);
    if (posNode) children.unshift(posNode);
  }

  if (!handled.has('ConnectionPoints') && nozzle.nodes && nozzle.nodes.length > 0) {
    children.push(buildConnectionPointsNode(nozzle.nodes));
  }

  const genAttrs = buildGenericAttributesNode(nozzle, 'Nozzle');
  if (genAttrs) {
    children.push(genAttrs);
  }

  return makeRawNode('Nozzle', attrs, children);
}

export function buildChamberNode(chamber: Chamber): RawNode {
  const id = chamber.proteusId || chamber.id;
  const dexpiClass = chamber.dexpiClass || 'Chamber';
  const componentClassUri = chamber.componentClassUri || rdlUriForClass(dexpiClass) || 'http://data.posccaesar.org/rdl/RDS903151421';

  const attrs: Record<string, string> = {
    ...(chamber._proteus ? chamber._proteus.attrs : {}),
    ID: id,
    ComponentClass: dexpiClass,
    ComponentClassURI: componentClassUri,
  };

  const children: RawNode[] = [];
  if (chamber._proteus && Array.isArray(chamber._proteus.extra)) {
    for (const child of chamber._proteus.extra) {
      if (isRawNode(child) && child.tag !== 'GenericAttributes') {
        children.push(child);
      }
    }
  }

  const genAttrs = buildGenericAttributesNode(chamber, 'Chamber');
  if (genAttrs) {
    children.push(genAttrs);
  }

  return makeRawNode('Chamber', attrs, children);
}

export function buildEquipmentNode(equipment: Equipment): RawNode {
  const id = equipment.proteusId || equipment.id;
  const dexpiClass = equipment.dexpiClass || 'Equipment';
  const componentClassUri = equipment.componentClassUri || rdlUriForClass(dexpiClass);

  const attrs: Record<string, string> = {
    ...(equipment._proteus ? equipment._proteus.attrs : {}),
    ID: id,
    ComponentClass: dexpiClass,
  };
  if (componentClassUri) attrs.ComponentClassURI = componentClassUri;
  if (equipment.tagName) attrs.TagName = equipment.tagName;

  const children: RawNode[] = [];
  const emittedNozzleIds = new Set<string>();
  const emittedChamberIds = new Set<string>();
  const handledTags = new Set<string>();

  if (equipment._proteus && Array.isArray(equipment._proteus.extra)) {
    for (const child of equipment._proteus.extra) {
      if (!isRawNode(child)) continue;

      if (child.tag === 'Position') {
        const posNode = buildPositionNode(equipment.position, child);
        if (posNode) children.push(posNode);
        handledTags.add('Position');
      } else if (child.tag === 'Extent') {
        const extNode = buildExtentNode(equipment.extent);
        if (extNode) children.push(extNode);
        handledTags.add('Extent');
      } else if (child.tag === 'Label') {
        if (
          equipment.tagName &&
          (child.attrs.ComponentClass === 'EquipmentTagNameLabel' ||
            child.attrs.ID?.includes('Label') ||
            !handledTags.has('Label'))
        ) {
          children.push(updateLabelText(child, equipment.tagName));
        } else {
          children.push(child);
        }
        handledTags.add('Label');
      } else if (child.tag === 'Nozzle') {
        const childId = child.attrs.ID;
        const matchingNozzle = equipment.nozzles?.find(
          (n) => (n.proteusId && n.proteusId === childId) || n.id === childId
        );
        if (matchingNozzle) {
          children.push(buildNozzleNode(matchingNozzle));
          emittedNozzleIds.add(matchingNozzle.id);
        } else {
          children.push(child);
        }
      } else if (child.tag === 'Chamber') {
        const childId = child.attrs.ID;
        const matchingChamber = equipment.chambers?.find(
          (c) => (c.proteusId && c.proteusId === childId) || c.id === childId
        );
        if (matchingChamber) {
          children.push(buildChamberNode(matchingChamber));
          emittedChamberIds.add(matchingChamber.id);
        } else {
          children.push(child);
        }
      } else if (child.tag === 'GenericAttributes') {
        // Will be appended at appropriate position or end
      } else {
        // Unmodeled element (Scale, Presentation, etc.)
        children.push(child);
      }
    }
  }

  // Fallbacks if not emitted via _proteus
  if (!handledTags.has('Position') && equipment.position) {
    const posNode = buildPositionNode(equipment.position);
    if (posNode) children.unshift(posNode);
  }

  if (!handledTags.has('Extent') && equipment.extent) {
    const extNode = buildExtentNode(equipment.extent);
    if (extNode) children.push(extNode);
  }

  if (!handledTags.has('Label') && equipment.tagName) {
    const labelNode = makeRawNode(
      'Label',
      {
        ID: `${id}-Label`,
        ComponentClass: 'EquipmentTagNameLabel',
        ComponentClassURI: 'http://sandbox.dexpi.org/rdl/EquipmentTagNameLabel',
      },
      [
        makeRawNode(
          'Text',
          {
            String: equipment.tagName,
            Font: 'Calibri',
            Height: '4',
            Width: '0',
            Justification: 'CenterCenter',
          },
          [
            makeRawNode('Position', {}, [
              makeRawNode('Location', {
                X: String(equipment.position?.location?.x ?? 0),
                Y: String((equipment.position?.location?.y ?? 0) + 25),
                Z: '0',
              }),
              makeRawNode('Axis', { X: '0', Y: '0', Z: '1' }),
              makeRawNode('Reference', { X: '1', Y: '0', Z: '0' }),
            ]),
          ]
        ),
      ]
    );
    children.push(labelNode);
  }

  // Any newly added nozzles that weren't in _proteus
  if (equipment.nozzles) {
    for (const n of equipment.nozzles) {
      if (!emittedNozzleIds.has(n.id)) {
        children.push(buildNozzleNode(n));
      }
    }
  }

  // Any newly added chambers
  if (equipment.chambers) {
    for (const c of equipment.chambers) {
      if (!emittedChamberIds.has(c.id)) {
        children.push(buildChamberNode(c));
      }
    }
  }

  const genAttrs = buildGenericAttributesNode(equipment, dexpiClass);
  if (genAttrs) {
    children.push(genAttrs);
  }

  return makeRawNode('Equipment', attrs, children);
}


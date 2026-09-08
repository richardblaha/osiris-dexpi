/**
 * Piping Systems, Segments, Components, and OffPageConnectors serializer for Proteus XML.
 */

import { rdlUriForClass } from '../rdl';
import type {
  PipingNetworkSystem,
  PipingNetworkSegment,
  PipingComponent,
  PipeOffPageConnector,
  Pipe,
  PipingConnection,
  PipingNetworkSegmentItem,
} from '../../classes/piping';
import type { RawNode } from '../raw';
import { makeRawNode, isRawNode } from '../raw';
import { buildGenericAttributesNode } from './genericAttributes';
import { buildPositionNode, buildCenterLineNode } from './geometry';
import { buildConnectionPointsNode, updateLabelText } from './equipment';

export function buildPipingComponentNode(comp: PipingComponent): RawNode {
  const id = comp.proteusId || comp.id;
  const dexpiClass = comp.dexpiClass || 'PipingComponent';
  const componentClassUri = comp.componentClassUri || rdlUriForClass(dexpiClass);

  const attrs: Record<string, string> = {
    ...(comp._proteus ? comp._proteus.attrs : {}),
    ID: id,
    ComponentClass: dexpiClass,
  };
  if (componentClassUri) attrs.ComponentClassURI = componentClassUri;
  if (comp.tagName) attrs.TagName = comp.tagName;
  if (!attrs.ComponentName) {
    attrs.ComponentName = `${dexpiClass.toUpperCase()}_SHAPE`;
  }

  const children: RawNode[] = [];
  const handledTags = new Set<string>();

  if (comp._proteus && Array.isArray(comp._proteus.extra)) {
    for (const child of comp._proteus.extra) {
      if (!isRawNode(child)) continue;

      if (child.tag === 'Position') {
        const posNode = buildPositionNode(comp.position, child);
        if (posNode) children.push(posNode);
        handledTags.add('Position');
      } else if (child.tag === 'ConnectionPoints') {
        children.push(buildConnectionPointsNode(comp.nodes || [], child));
        handledTags.add('ConnectionPoints');
      } else if (child.tag === 'Label') {
        if (comp.tagName) {
          children.push(updateLabelText(child, comp.tagName));
        } else {
          children.push(child);
        }
      } else if (child.tag === 'GenericAttributes') {
        // Handled after
      } else {
        children.push(child);
      }
    }
  }

  if (!handledTags.has('Position') && comp.position) {
    const posNode = buildPositionNode(comp.position);
    if (posNode) children.unshift(posNode);
  }

  if (!handledTags.has('ConnectionPoints') && comp.nodes && comp.nodes.length > 0) {
    children.push(buildConnectionPointsNode(comp.nodes));
  }

  const genAttrs = buildGenericAttributesNode(comp, dexpiClass);
  if (genAttrs) {
    children.push(genAttrs);
  }

  return makeRawNode('PipingComponent', attrs, children);
}

export function buildPipeOffPageConnectorNode(opc: PipeOffPageConnector): RawNode {
  const id = opc.proteusId || opc.id;
  const dexpiClass = opc.dexpiClass || 'PipeOffPageConnector';
  const componentClassUri = opc.componentClassUri || rdlUriForClass(dexpiClass);

  const attrs: Record<string, string> = {
    ...(opc._proteus ? opc._proteus.attrs : {}),
    ID: id,
    ComponentClass: dexpiClass,
  };
  if (componentClassUri) attrs.ComponentClassURI = componentClassUri;

  const children: RawNode[] = [];
  const handledTags = new Set<string>();

  if (opc._proteus && Array.isArray(opc._proteus.extra)) {
    for (const child of opc._proteus.extra) {
      if (!isRawNode(child)) continue;

      if (child.tag === 'Position') {
        const posNode = buildPositionNode(opc.position, child);
        if (posNode) children.push(posNode);
        handledTags.add('Position');
      } else if (child.tag === 'ConnectionPoints') {
        children.push(buildConnectionPointsNode(opc.nodes || [], child));
        handledTags.add('ConnectionPoints');
      } else if (child.tag === 'GenericAttributes') {
        // Handled after
      } else {
        children.push(child);
      }
    }
  }

  if (!handledTags.has('Position') && opc.position) {
    const posNode = buildPositionNode(opc.position);
    if (posNode) children.push(posNode);
  }

  if (!handledTags.has('ConnectionPoints') && opc.nodes && opc.nodes.length > 0) {
    children.push(buildConnectionPointsNode(opc.nodes));
  }

  const genAttrs = buildGenericAttributesNode(opc, dexpiClass);
  if (genAttrs) {
    children.push(genAttrs);
  }

  return makeRawNode('PipeOffPageConnector', attrs, children);
}

export function buildPipingNetworkSegmentNode(
  seg: PipingNetworkSegment,
  objectMap?: Map<string, any>
): RawNode {
  const id = seg.proteusId || seg.id;
  const dexpiClass = seg.dexpiClass || 'PipingNetworkSegment';
  const componentClassUri = seg.componentClassUri || rdlUriForClass(dexpiClass) || 'http://data.posccaesar.org/rdl/RDS267704';

  const attrs: Record<string, string> = {
    ...(seg._proteus ? seg._proteus.attrs : {}),
    ID: id,
    ComponentClass: dexpiClass,
    ComponentClassURI: componentClassUri,
  };
  if (seg.fluidCode) attrs.FluidCode = seg.fluidCode;
  if (seg.nominalDiameterRepresentation) attrs.NominalDiameter = seg.nominalDiameterRepresentation;

  const children: RawNode[] = [];
  const emittedItemIds = new Set<string>();
  let pipeIndex = 0;
  const pipes: Pipe[] = (seg.connections || []).filter(
    (c): c is Pipe => 'centerLine' in c && !!c.centerLine
  );

  const resolveProteusId = (itemId?: string): string | undefined => {
    if (!itemId) return undefined;
    const obj = objectMap?.get(itemId);
    return obj?.proteusId || itemId;
  };

  if (seg._proteus && Array.isArray(seg._proteus.extra)) {
    for (const child of seg._proteus.extra) {
      if (!isRawNode(child)) continue;

      if (child.tag === 'GenericAttributes') {
        const genAttrs = buildGenericAttributesNode(seg, 'PipingNetworkSegment');
        if (genAttrs) children.push(genAttrs);
      } else if (child.tag === 'PipingComponent') {
        const childId = child.attrs.ID;
        const matchingComp = seg.items?.find(
          (i) => (i.proteusId && i.proteusId === childId) || i.id === childId
        );
        if (matchingComp && 'nodes' in matchingComp) {
          children.push(buildPipingComponentNode(matchingComp as PipingComponent));
          emittedItemIds.add(matchingComp.id);
        } else {
          children.push(child);
        }
      } else if (child.tag === 'PipeOffPageConnector') {
        const childId = child.attrs.ID;
        const matchingOpc = seg.items?.find(
          (i) => (i.proteusId && i.proteusId === childId) || i.id === childId
        );
        if (matchingOpc) {
          children.push(buildPipeOffPageConnectorNode(matchingOpc as PipeOffPageConnector));
          emittedItemIds.add(matchingOpc.id);
        } else {
          children.push(child);
        }
      } else if (child.tag === 'CenterLine') {
        const pipe = pipes[pipeIndex++];
        const cl = pipe?.centerLine || seg.centerLine;
        const clNode = buildCenterLineNode(cl, child);
        if (clNode) children.push(clNode);
      } else if (child.tag === 'Connection') {
        const fromId = resolveProteusId(seg.sourceItem) || child.attrs.FromID;
        const toId = resolveProteusId(seg.targetItem) || child.attrs.ToID;
        children.push(
          makeRawNode('Connection', {
            ...child.attrs,
            FromID: fromId || '',
            ToID: toId || '',
          })
        );
      } else {
        children.push(child);
      }
    }
  } else {
    // Canonical order for new segment
    const genAttrs = buildGenericAttributesNode(seg, 'PipingNetworkSegment');
    if (genAttrs) children.push(genAttrs);

    if (pipes.length > 0) {
      for (const p of pipes) {
        const clNode = buildCenterLineNode(p.centerLine);
        if (clNode) children.push(clNode);
      }
    } else if (seg.centerLine) {
      const clNode = buildCenterLineNode(seg.centerLine);
      if (clNode) children.push(clNode);
    }

    if (seg.items) {
      for (const item of seg.items) {
        if (item.dexpiClass === 'PipeOffPageConnector' || (item as any).ComponentClass?.includes('OffPageConnector')) {
          children.push(buildPipeOffPageConnectorNode(item as PipeOffPageConnector));
        } else {
          children.push(buildPipingComponentNode(item as PipingComponent));
        }
      }
    }

    if (seg.sourceItem && seg.targetItem) {
      const fromId = resolveProteusId(seg.sourceItem);
      const toId = resolveProteusId(seg.targetItem);
      children.push(
        makeRawNode('Connection', {
          FromID: fromId || '',
          FromNode: '1',
          ToID: toId || '',
          ToNode: '1',
        })
      );
    }
  }

  return makeRawNode('PipingNetworkSegment', attrs, children);
}

export function buildPipingNetworkSystemNode(
  system: PipingNetworkSystem,
  objectMap?: Map<string, any>
): RawNode {
  const id = system.proteusId || system.id;
  const dexpiClass = system.dexpiClass || 'PipingNetworkSystem';
  const componentClassUri = system.componentClassUri || rdlUriForClass(dexpiClass) || 'http://data.posccaesar.org/rdl/RDS270359';

  const attrs: Record<string, string> = {
    ...(system._proteus ? system._proteus.attrs : {}),
    ID: id,
    ComponentClass: dexpiClass,
    ComponentClassURI: componentClassUri,
  };
  if (system.lineNumber) {
    if (attrs.LineNumber) attrs.LineNumber = system.lineNumber;
    else attrs.TagName = system.lineNumber;
  }
  if (system.fluidCode) attrs.FluidCode = system.fluidCode;

  const children: RawNode[] = [];
  const emittedSegIds = new Set<string>();

  if (system._proteus && Array.isArray(system._proteus.extra)) {
    for (const child of system._proteus.extra) {
      if (!isRawNode(child)) continue;

      if (child.tag === 'GenericAttributes') {
        const genAttrs = buildGenericAttributesNode(system, 'PipingNetworkSystem');
        if (genAttrs) children.push(genAttrs);
      } else if (child.tag === 'PipingNetworkSegment') {
        const childId = child.attrs.ID;
        const matchingSeg = system.segments?.find(
          (s) => (s.proteusId && s.proteusId === childId) || s.id === childId
        );
        if (matchingSeg) {
          children.push(buildPipingNetworkSegmentNode(matchingSeg, objectMap));
          emittedSegIds.add(matchingSeg.id);
        } else {
          children.push(child);
        }
      } else {
        children.push(child);
      }
    }
  }

  // Any newly added segments
  if (system.segments) {
    for (const seg of system.segments) {
      if (!emittedSegIds.has(seg.id)) {
        children.push(buildPipingNetworkSegmentNode(seg, objectMap));
      }
    }
  }

  if (!system._proteus) {
    const genAttrs = buildGenericAttributesNode(system, 'PipingNetworkSystem');
    if (genAttrs) children.unshift(genAttrs);
  }

  return makeRawNode('PipingNetworkSystem', attrs, children);
}


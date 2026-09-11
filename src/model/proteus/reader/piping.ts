/**
 * Piping Network Systems, Segments, Components, and Connections reader.
 * Ports pyDEXPI parser_modules.py:2404-2493 for segment connection inference.
 */

import { make } from '../../factory';
import { rdlUriForClass } from '../rdl';
import type {
  PipingNetworkSystem,
  PipingNetworkSegment,
  PipingConnection,
  Pipe,
  DirectPipingConnection,
  PipingComponent,
  PipingNetworkSegmentItem,
  PipeOffPageConnector,
  PropertyBreak,
} from '../../classes/piping';
import type { PipingNode } from '../../classes/equipment';
import type { RawNode } from '../raw';
import { childNamed, childrenNamed } from '../raw';
import { parseGenericAttributeSets } from './genericAttributes';
import { parsePosition, parseExtent, parseScale, parseCenterLine } from './geometry';
import { parseInlinePrimitives } from './graphics';
import type { ParseContext } from '../core';

export interface PendingSegmentConnection {
  segment: PipingNetworkSegment;
  fromId?: string;
  fromNode?: number;
  toId?: string;
  toNode?: number;
  orderedElements: (PipingNetworkSegmentItem | PipingConnection)[];
  mainInflowNodes: Map<string, string>; // item.id -> node.id
  mainOutflowNodes: Map<string, string>; // item.id -> node.id
}

export function parsePipingComponent(node: RawNode, ctx: ParseContext): PipingComponent {
  const proteusId = node.attrs.ID || `PipingComponent-${Date.now()}`;
  const dexpiClass = node.attrs.ComponentClass || 'PipingComponent';
  const componentClassUri = node.attrs.ComponentClassURI || rdlUriForClass(dexpiClass);
  const tagName = node.attrs.TagName;

  const position = parsePosition(node);
  const extent = parseExtent(node);
  const scale = parseScale(node);

  // Parse ConnectionPoints -> Node
  const nodes: PipingNode[] = [];
  const connPointsNode = childNamed(node, 'ConnectionPoints');
  let flowInIdx = 1;
  let flowOutIdx = 2;

  if (connPointsNode) {
    if (connPointsNode.attrs.FlowIn) flowInIdx = parseInt(connPointsNode.attrs.FlowIn, 10);
    if (connPointsNode.attrs.FlowOut) flowOutIdx = parseInt(connPointsNode.attrs.FlowOut, 10);

    const nodeElements = childrenNamed(connPointsNode, 'Node');
    for (let idx = 0; idx < nodeElements.length; idx++) {
      const ne = nodeElements[idx];
      const nodeProteusId = ne.attrs.ID || `${proteusId}-Node-${idx + 1}`;
      const pipingNode = make<PipingNode>('PipingNode', {
        proteusId: nodeProteusId,
        nodeType: ne.attrs.Type || 'process',
        nodeNumber: idx + 1,
        position: parsePosition(ne) || position,
      });
      ctx.objectRegistry.register(pipingNode, nodeProteusId);
      nodes.push(pipingNode);
    }
  }

  // Fallback: at least 2 nodes for inline valve
  if (nodes.length === 0) {
    for (let i = 1; i <= 2; i++) {
      const nodeProteusId = `${proteusId}-Node-${i}`;
      const pipingNode = make<PipingNode>('PipingNode', {
        proteusId: nodeProteusId,
        nodeType: 'process',
        nodeNumber: i,
        position,
      });
      ctx.objectRegistry.register(pipingNode, nodeProteusId);
      nodes.push(pipingNode);
    }
  }

  const { typedAttributes, customAttributes } = parseGenericAttributeSets(node, dexpiClass);

  const component = make<PipingComponent>(dexpiClass, {
    proteusId,
    dexpiClass,
    componentClassUri,
    // Most Proteus piping components (valves, tees, reducers...) carry no
    // `TagName` at all — leave it unset rather than falling back to the raw
    // element ID, or every untagged symbol would show its internal XML ID as
    // a label (e.g. "GlobeValve-2", "PipeTee-3") instead of staying unlabeled
    // like the reference renderer draws them.
    tagName,
    nodes,
    position,
    extent,
    scale,
    componentName: node.attrs.ComponentName,
    graphics: parseInlinePrimitives(node),
    attributes: typedAttributes,
    customAttributes,
    _proteus: {
      attrs: { ...node.attrs },
      extra: [...node.children],
      childOrder: node.children.map((c) => (typeof c === 'string' ? '#text' : c.tag)),
    },
  });

  ctx.objectRegistry.register(component, proteusId);
  return component;
}

export function parsePipeOffPageConnector(
  node: RawNode,
  ctx: ParseContext
): PipeOffPageConnector {
  const proteusId = node.attrs.ID || `OffPageConnector-${Date.now()}`;
  const dexpiClass = node.attrs.ComponentClass || 'PipeOffPageConnector';

  const nodes: PipingNode[] = [];
  const connPointsNode = childNamed(node, 'ConnectionPoints');
  if (connPointsNode) {
    const nodeElements = childrenNamed(connPointsNode, 'Node');
    for (const ne of nodeElements) {
      const nodeProteusId = ne.attrs.ID || `${proteusId}-Node`;
      const pipingNode = make<PipingNode>('PipingNode', {
        proteusId: nodeProteusId,
        nodeType: ne.attrs.Type || 'process',
      });
      ctx.objectRegistry.register(pipingNode, nodeProteusId);
      nodes.push(pipingNode);
    }
  }

  const connector = make<PipeOffPageConnector>(dexpiClass, {
    proteusId,
    nodes,
    position: parsePosition(node),
    scale: parseScale(node),
    componentName: node.attrs.ComponentName,
    graphics: parseInlinePrimitives(node),
    _proteus: {
      attrs: { ...node.attrs },
      extra: [...node.children],
      childOrder: node.children.map((c) => (typeof c === 'string' ? '#text' : c.tag)),
    },
  });

  ctx.objectRegistry.register(connector, proteusId);
  return connector;
}

export function parsePipingNetworkSegment(
  node: RawNode,
  ctx: ParseContext
): { segment: PipingNetworkSegment; pending: PendingSegmentConnection } {
  const proteusId = node.attrs.ID || `PipingNetworkSegment-${Date.now()}`;
  const dexpiClass = node.attrs.ComponentClass || 'PipingNetworkSegment';

  const items: PipingNetworkSegmentItem[] = [];
  const connections: PipingConnection[] = [];
  const orderedElements: (PipingNetworkSegmentItem | PipingConnection)[] = [];
  const mainInflowNodes = new Map<string, string>();
  const mainOutflowNodes = new Map<string, string>();

  let fromId: string | undefined;
  let fromNode: number | undefined;
  let toId: string | undefined;
  let toNode: number | undefined;

  let segmentCenterLine: { points: { x: number; y: number }[] } | undefined;

  // Walk ordered children of segment
  for (const child of node.children) {
    if (typeof child === 'string') continue;

    if (child.tag === 'PipingComponent') {
      const comp = parsePipingComponent(child, ctx);
      items.push(comp);
      orderedElements.push(comp);

      // determine inflow/outflow node ids
      if (comp.nodes.length >= 2) {
        mainInflowNodes.set(comp.id, comp.nodes[0].id);
        mainOutflowNodes.set(comp.id, comp.nodes[1].id);
      } else if (comp.nodes.length === 1) {
        mainInflowNodes.set(comp.id, comp.nodes[0].id);
        mainOutflowNodes.set(comp.id, comp.nodes[0].id);
      }
    } else if (child.tag === 'PipeOffPageConnector' || child.attrs.ComponentClass?.includes('OffPageConnector')) {
      const opc = parsePipeOffPageConnector(child, ctx);
      items.push(opc);
      orderedElements.push(opc);
      if (opc.nodes && opc.nodes.length > 0) {
        mainInflowNodes.set(opc.id, opc.nodes[0].id);
        mainOutflowNodes.set(opc.id, opc.nodes[0].id);
      }
    } else if (child.tag === 'CenterLine') {
      const cl = parseCenterLine(node);
      const points = child.children
        .filter((c): c is RawNode => typeof c !== 'string' && c.tag === 'Coordinate')
        .map((c) => ({
          x: parseFloat(c.attrs.X || '0'),
          y: parseFloat(c.attrs.Y || '0'),
        }));

      if (!segmentCenterLine && points.length > 0) {
        segmentCenterLine = { points };
      }

      const pipe = make<Pipe>('Pipe', {
        centerLine: { points },
      });
      connections.push(pipe);
      orderedElements.push(pipe);
    } else if (child.tag === 'Connection') {
      fromId = child.attrs.FromID;
      if (child.attrs.FromNode) fromNode = parseInt(child.attrs.FromNode, 10);
      toId = child.attrs.ToID;
      if (child.attrs.ToNode) toNode = parseInt(child.attrs.ToNode, 10);
    }
  }

  const { typedAttributes, customAttributes } = parseGenericAttributeSets(node, 'PipingNetworkSegment');

  const segment = make<PipingNetworkSegment>(dexpiClass, {
    proteusId,
    fluidCode: node.attrs.FluidCode || (typedAttributes.fluidCode as string),
    nominalDiameterRepresentation:
      node.attrs.NominalDiameter || (typedAttributes.nominalDiameterRepresentation as string),
    connections,
    items,
    centerLine: segmentCenterLine,
    customAttributes,
    ...typedAttributes,
    _proteus: {
      attrs: { ...node.attrs },
      extra: [...node.children],
      childOrder: node.children.map((c) => (typeof c === 'string' ? '#text' : c.tag)),
    },
  });

  ctx.objectRegistry.register(segment, proteusId);

  const pending: PendingSegmentConnection = {
    segment,
    fromId,
    fromNode,
    toId,
    toNode,
    orderedElements,
    mainInflowNodes,
    mainOutflowNodes,
  };

  return { segment, pending };
}

export function parsePipingNetworkSystem(
  node: RawNode,
  ctx: ParseContext
): { system: PipingNetworkSystem; pendingSegments: PendingSegmentConnection[] } {
  const proteusId = node.attrs.ID || `PipingNetworkSystem-${Date.now()}`;
  const dexpiClass = node.attrs.ComponentClass || 'PipingNetworkSystem';

  const segments: PipingNetworkSegment[] = [];
  const pendingSegments: PendingSegmentConnection[] = [];

  const segNodes = childrenNamed(node, 'PipingNetworkSegment');
  for (const sn of segNodes) {
    const { segment, pending } = parsePipingNetworkSegment(sn, ctx);
    segments.push(segment);
    pendingSegments.push(pending);
  }

  const { typedAttributes, customAttributes } = parseGenericAttributeSets(node, 'PipingNetworkSystem');

  const system = make<PipingNetworkSystem>(dexpiClass, {
    proteusId,
    lineNumber: (typedAttributes.lineNumber as string) || node.attrs.TagName,
    fluidCode: (typedAttributes.fluidCode as string) || node.attrs.FluidCode,
    segments,
    customAttributes,
    ...typedAttributes,
    _proteus: {
      attrs: { ...node.attrs },
      extra: [...node.children],
      childOrder: node.children.map((c) => (typeof c === 'string' ? '#text' : c.tag)),
    },
  });

  ctx.objectRegistry.register(system, proteusId);
  return { system, pendingSegments };
}

/**
 * Resolves references across piping segments in the second pass.
 * Implements pyDEXPI segment connection & reversal logic.
 */
export function resolveSegmentConnections(
  pendingList: PendingSegmentConnection[],
  ctx: ParseContext
): void {
  for (const p of pendingList) {
    const { segment, orderedElements, mainInflowNodes, mainOutflowNodes } = p;

    // Check if segment is reversed based on connection endpoints
    const sourceObj = p.fromId ? ctx.objectRegistry.getByProteusId(p.fromId) : undefined;
    const targetObj = p.toId ? ctx.objectRegistry.getByProteusId(p.toId) : undefined;

    let isReversed = false;
    if (orderedElements.length > 0) {
      const first = orderedElements[0];
      const last = orderedElements[orderedElements.length - 1];
      if (sourceObj && last && sourceObj.id === last.id) {
        isReversed = true;
      } else if (targetObj && first && targetObj.id === first.id) {
        isReversed = true;
      }
    }

    if (isReversed) {
      segment.items.reverse();
      segment.connections.reverse();
      orderedElements.reverse();
    }

    // Direct piping connection insertion at ends if needed
    const firstElem = orderedElements[0];
    if (sourceObj && firstElem && sourceObj.id !== firstElem.id) {
      if (!('centerLine' in firstElem)) {
        const directConn = make<DirectPipingConnection>('DirectPipingConnection');
        orderedElements.unshift(directConn);
        segment.connections.unshift(directConn);
      }
    }

    const lastElem = orderedElements[orderedElements.length - 1];
    if (targetObj && lastElem && targetObj.id !== lastElem.id) {
      if (!('centerLine' in lastElem)) {
        const directConn = make<DirectPipingConnection>('DirectPipingConnection');
        orderedElements.push(directConn);
        segment.connections.push(directConn);
      }
    }

    // Assign internal sources and targets for consecutive items & connections
    for (let i = 0; i < orderedElements.length; i++) {
      const elem = orderedElements[i];
      if ('sourceItem' in elem || 'centerLine' in elem) {
        const conn = elem as PipingConnection;

        // Source item/node
        if (i > 0) {
          const prev = orderedElements[i - 1];
          if ('nodes' in prev) {
            conn.sourceItem = prev.id;
            conn.sourceNode = mainOutflowNodes.get(prev.id);
          }
        }

        // Target item/node
        if (i < orderedElements.length - 1) {
          const next = orderedElements[i + 1];
          if ('nodes' in next) {
            conn.targetItem = next.id;
            conn.targetNode = mainInflowNodes.get(next.id);
          }
        }
      }
    }

    // Assign external source and target to the segment
    if (sourceObj) {
      segment.sourceItem = sourceObj.id;
      if (sourceObj.nodes && sourceObj.nodes.length > 0) {
        const nIdx = (p.fromNode || 1) - 1;
        segment.sourceNode = sourceObj.nodes[nIdx]?.id || sourceObj.nodes[0]?.id;
      }
      if (orderedElements.length > 0 && 'sourceItem' in orderedElements[0]) {
        (orderedElements[0] as PipingConnection).sourceItem = segment.sourceItem;
        (orderedElements[0] as PipingConnection).sourceNode = segment.sourceNode;
      }
    }

    if (targetObj) {
      segment.targetItem = targetObj.id;
      if (targetObj.nodes && targetObj.nodes.length > 0) {
        const nIdx = (p.toNode || 1) - 1;
        segment.targetNode = targetObj.nodes[nIdx]?.id || targetObj.nodes[0]?.id;
      }
      if (orderedElements.length > 0 && 'targetItem' in orderedElements[orderedElements.length - 1]) {
        const lastConn = orderedElements[orderedElements.length - 1] as PipingConnection;
        lastConn.targetItem = segment.targetItem;
        lastConn.targetNode = segment.targetNode;
      }
    }
  }
}


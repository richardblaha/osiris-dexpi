/**
 * Serializes geometry structures back into Proteus XML nodes.
 */

import type { Point, Position, Extent } from '../../classes/graphics';
import type { RawNode } from '../raw';
import { makeRawNode, isRawNode } from '../raw';

export function buildPointNode(tag: string, pt: { x?: number; y?: number; z?: number }): RawNode {
  const attrs: Record<string, string> = {
    X: String(pt.x ?? 0),
    Y: String(pt.y ?? 0),
  };
  if (pt.z !== undefined) {
    attrs.Z = String(pt.z);
  }
  return makeRawNode(tag, attrs);
}

export function buildPositionNode(pos?: Position, existingNode?: RawNode): RawNode | undefined {
  if (!pos || !pos.location) return undefined;

  const children: RawNode[] = [];
  const locZ = pos.location.z !== undefined ? pos.location.z : (existingNode ? 0 : 0);
  children.push(buildPointNode('Location', { x: pos.location.x, y: pos.location.y, z: locZ }));

  if (pos.axis) {
    children.push(buildPointNode('Axis', pos.axis));
  } else if (existingNode) {
    const origAxis = existingNode.children.find((c): c is RawNode => isRawNode(c) && c.tag === 'Axis');
    if (origAxis) children.push(origAxis);
    else children.push(buildPointNode('Axis', { x: 0, y: 0, z: 1 }));
  } else {
    children.push(buildPointNode('Axis', { x: 0, y: 0, z: 1 }));
  }

  if (pos.reference) {
    children.push(buildPointNode('Reference', pos.reference));
  } else if (existingNode) {
    const origRef = existingNode.children.find((c): c is RawNode => isRawNode(c) && c.tag === 'Reference');
    if (origRef) children.push(origRef);
    else children.push(buildPointNode('Reference', { x: 1, y: 0, z: 0 }));
  } else {
    children.push(buildPointNode('Reference', { x: 1, y: 0, z: 0 }));
  }

  return makeRawNode('Position', {}, children);
}

export function buildExtentNode(extent?: Extent): RawNode | undefined {
  if (!extent) return undefined;
  return makeRawNode('Extent', {}, [
    buildPointNode('Min', extent.min),
    buildPointNode('Max', extent.max),
  ]);
}

export function buildCenterLineNode(
  centerLine?: { points?: { x: number; y: number }[] },
  existingNode?: RawNode
): RawNode | undefined {
  if (!centerLine || !centerLine.points || centerLine.points.length === 0) return undefined;

  const children: RawNode[] = [];

  // Preserve non-Coordinate children from existing node (e.g. <Presentation ... />)
  if (existingNode) {
    for (const child of existingNode.children) {
      if (isRawNode(child) && child.tag !== 'Coordinate') {
        children.push(child);
      }
    }
  } else {
    // Default presentation for new pipelines
    children.push(
      makeRawNode('Presentation', {
        LineType: '0',
        LineWeight: '0.5',
        R: '0',
        G: '0',
        B: '0',
      })
    );
  }

  for (const pt of centerLine.points) {
    children.push(makeRawNode('Coordinate', { X: String(pt.x), Y: String(pt.y) }));
  }

  const attrs: Record<string, string> = {
    ...(existingNode ? existingNode.attrs : {}),
    NumPoints: String(centerLine.points.length),
  };

  return makeRawNode('CenterLine', attrs, children);
}


/**
 * Proteus XML geometry parsing helpers (Position, Extent, Scale, CenterLine).
 */

import type { Point, Position, Extent } from '../../classes/graphics';
import type { RawNode } from '../raw';
import { childNamed, childrenNamed } from '../raw';

export function parsePoint(node?: RawNode): Point | undefined {
  if (!node) return undefined;
  const x = parseFloat(node.attrs.X ?? node.attrs.LocationX ?? '0');
  const y = parseFloat(node.attrs.Y ?? node.attrs.LocationY ?? '0');
  const z = parseFloat(node.attrs.Z ?? node.attrs.LocationZ ?? '0');
  return {
    x: isNaN(x) ? 0 : x,
    y: isNaN(y) ? 0 : y,
    z: isNaN(z) ? 0 : z,
  };
}

export function parsePosition(containerNode: RawNode): Position | undefined {
  const posNode = childNamed(containerNode, 'Position');
  if (!posNode) {
    // Check flat LocationX/LocationY attributes
    if ('LocationX' in containerNode.attrs && 'LocationY' in containerNode.attrs) {
      const pt = parsePoint(containerNode);
      return pt ? { location: pt } : undefined;
    }
    return undefined;
  }

  const locNode = childNamed(posNode, 'Location');
  const axisNode = childNamed(posNode, 'Axis');
  const refNode = childNamed(posNode, 'Reference');

  const location = parsePoint(locNode) || { x: 0, y: 0, z: 0 };
  const axis = parsePoint(axisNode);
  const reference = parsePoint(refNode);

  return { location, axis, reference };
}

export function parseExtent(containerNode: RawNode): Extent | undefined {
  const extNode = childNamed(containerNode, 'Extent');
  if (!extNode) {
    // Check flat MinX, MinY, MaxX, MaxY attributes
    if ('MinX' in containerNode.attrs && 'MaxX' in containerNode.attrs) {
      const minX = parseFloat(containerNode.attrs.MinX || '0');
      const minY = parseFloat(containerNode.attrs.MinY || '0');
      const maxX = parseFloat(containerNode.attrs.MaxX || '0');
      const maxY = parseFloat(containerNode.attrs.MaxY || '0');
      return {
        min: { x: minX, y: minY },
        max: { x: maxX, y: maxY },
      };
    }
    return undefined;
  }

  const minNode = childNamed(extNode, 'Min');
  const maxNode = childNamed(extNode, 'Max');

  const min = parsePoint(minNode) || { x: 0, y: 0 };
  const max = parsePoint(maxNode) || { x: 0, y: 0 };

  return { min, max };
}

export function parseCenterLine(containerNode: RawNode): { points: { x: number; y: number }[] } | undefined {
  const clNode = childNamed(containerNode, 'CenterLine');
  if (!clNode) return undefined;

  const coordNodes = childrenNamed(clNode, 'Coordinate');
  const points = coordNodes.map((c) => {
    const x = parseFloat(c.attrs.X || '0');
    const y = parseFloat(c.attrs.Y || '0');
    return { x: isNaN(x) ? 0 : x, y: isNaN(y) ? 0 : y };
  });

  return { points };
}


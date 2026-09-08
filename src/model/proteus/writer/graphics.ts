/**
 * Graphics, Drawing, and ShapeCatalogue serializer for Proteus XML.
 */

import type { Diagram, ShapeCatalogue } from '../../classes/graphics';
import type { RawNode } from '../raw';
import { makeRawNode, isRawNode } from '../raw';

export function buildDrawingNode(diagram?: Diagram): RawNode | undefined {
  if (!diagram) return undefined;

  if (diagram._proteus) {
    return makeRawNode(
      'Drawing',
      diagram._proteus.attrs || { Name: diagram.name || 'PID', Type: 'PID' },
      diagram._proteus.extra || []
    );
  }

  const minX = diagram.minX ?? 0;
  const minY = diagram.minY ?? 0;
  const maxX = diagram.maxX ?? 420;
  const maxY = diagram.maxY ?? 297;

  return makeRawNode(
    'Drawing',
    {
      Name: diagram.name || 'PID',
      Type: 'PID',
    },
    [
      makeRawNode('Presentation', { R: '1', G: '1', B: '1' }),
      makeRawNode('Extent', {}, [
        makeRawNode('Min', { X: String(minX), Y: String(minY) }),
        makeRawNode('Max', { X: String(maxX), Y: String(maxY) }),
      ]),
    ]
  );
}

export function buildShapeCatalogueNode(cat: ShapeCatalogue): RawNode {
  if (cat._proteus) {
    return makeRawNode(
      'ShapeCatalogue',
      cat._proteus.attrs || { Name: cat.name || 'Shapes' },
      cat._proteus.extra || []
    );
  }

  return makeRawNode(
    'ShapeCatalogue',
    { Name: cat.name || 'Shapes' },
    []
  );
}


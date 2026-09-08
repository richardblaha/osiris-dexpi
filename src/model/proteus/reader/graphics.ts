/**
 * Graphics, Drawing, and ShapeCatalogue reader for Proteus XML.
 */

import { make } from '../../factory';
import type {
  Diagram,
  DrawingBorder,
  ShapeCatalogue,
  Shape,
  RepresentationGroup,
  Static,
  Label,
  Text,
  PolyLine,
  Polygon,
  Circle,
  Ellipse,
  GraphicPrimitive,
} from '../../classes/graphics';
import type { RawNode } from '../raw';
import { childNamed, childrenNamed } from '../raw';
import { parsePosition, parseExtent } from './geometry';
import type { ParseContext } from '../core';

export function parsePrimitive(node: RawNode): GraphicPrimitive | undefined {
  const pos = parsePosition(node);

  if (node.tag === 'Text') {
    const text: Text = {
      string: node.attrs.String || '',
      font: node.attrs.Font,
      height: node.attrs.Height ? parseFloat(node.attrs.Height) : undefined,
      width: node.attrs.Width ? parseFloat(node.attrs.Width) : undefined,
      justification: node.attrs.Justification,
      textAngle: node.attrs.TextAngle ? parseFloat(node.attrs.TextAngle) : undefined,
      position: pos,
    };
    return text;
  }

  if (node.tag === 'PolyLine') {
    const coords = childrenNamed(node, 'Coordinate').map((c) => ({
      x: parseFloat(c.attrs.X || '0'),
      y: parseFloat(c.attrs.Y || '0'),
    }));
    const poly: PolyLine = { points: coords };
    return poly;
  }

  if (node.tag === 'Polygon') {
    const coords = childrenNamed(node, 'Coordinate').map((c) => ({
      x: parseFloat(c.attrs.X || '0'),
      y: parseFloat(c.attrs.Y || '0'),
    }));
    const poly: Polygon = { points: coords };
    return poly;
  }

  if (node.tag === 'Circle') {
    const circle: Circle = {
      radius: parseFloat(node.attrs.Radius || '0'),
      position: pos,
    };
    return circle;
  }

  if (node.tag === 'Ellipse') {
    const ellipse: Ellipse = {
      majorRadius: parseFloat(node.attrs.MajorRadius || '0'),
      minorRadius: parseFloat(node.attrs.MinorRadius || '0'),
      position: pos,
    };
    return ellipse;
  }

  return undefined;
}

export function parseShape(node: RawNode, ctx: ParseContext): Shape {
  const proteusId = node.attrs.ID || `Shape-${Date.now()}`;
  const componentName = node.attrs.ComponentName;
  const componentClass = node.attrs.ComponentClass;
  const componentClassUri = node.attrs.ComponentClassURI;

  const primitives: GraphicPrimitive[] = [];
  for (const child of node.children) {
    if (typeof child === 'string') continue;
    const prim = parsePrimitive(child);
    if (prim) primitives.push(prim);
  }

  const shape = make<Shape>('Shape', {
    proteusId,
    componentName,
    componentClass,
    componentClassUri,
    primitives,
    _proteus: {
      attrs: { ...node.attrs },
      extra: [...node.children],
      childOrder: node.children.map((c) => (typeof c === 'string' ? '#text' : c.tag)),
    },
  });

  ctx.objectRegistry.register(shape, proteusId);
  return shape;
}

export function parseShapeCatalogue(node: RawNode, ctx: ParseContext): ShapeCatalogue {
  const proteusId = node.attrs.ID || 'ShapeCatalogue-1';
  const name = node.attrs.Name || 'Shapes';

  const shapes: Shape[] = [];
  for (const child of node.children) {
    if (typeof child === 'string') continue;
    // Each child is an equipment/component shape definition
    shapes.push(parseShape(child, ctx));
  }

  const catalogue = make<ShapeCatalogue>('ShapeCatalogue', {
    proteusId,
    name,
    shapes,
    _proteus: {
      attrs: { ...node.attrs },
      extra: [...node.children],
      childOrder: node.children.map((c) => (typeof c === 'string' ? '#text' : c.tag)),
    },
  });

  ctx.objectRegistry.register(catalogue, proteusId);
  return catalogue;
}

export function parseDrawing(node: RawNode, ctx: ParseContext): Diagram {
  const proteusId = node.attrs.ID || 'Drawing-1';
  const name = node.attrs.Name || 'PID';

  const extent = parseExtent(node);
  const groups: any[] = [];

  for (const child of node.children) {
    if (typeof child === 'string') continue;
    if (child.tag === 'DrawingBorder') {
      const border = make<DrawingBorder>('DrawingBorder', {
        proteusId: child.attrs.ID || 'DrawingBorder-1',
        elements: child.children
          .filter((c): c is RawNode => typeof c !== 'string')
          .map((c) => parsePrimitive(c))
          .filter((p): p is GraphicPrimitive => !!p),
        _proteus: {
          attrs: { ...child.attrs },
          extra: [...child.children],
        },
      });
      groups.push(border);
    } else if (child.tag === 'Label') {
      const label = make<Label>('Label', {
        proteusId: child.attrs.ID || 'Label-1',
        texts: childrenNamed(child, 'Text')
          .map(parsePrimitive)
          .filter((p): p is Text => !!p && 'string' in p),
        position: parsePosition(child),
        _proteus: {
          attrs: { ...child.attrs },
          extra: [...child.children],
        },
      });
      groups.push(label);
    }
  }

  const diagram = make<Diagram>('Diagram', {
    proteusId,
    name,
    minX: extent?.min.x ?? 0,
    minY: extent?.min.y ?? 0,
    maxX: extent?.max.x ?? 420,
    maxY: extent?.max.y ?? 297,
    groups,
    _proteus: {
      attrs: { ...node.attrs },
      extra: [...node.children],
      childOrder: node.children.map((c) => (typeof c === 'string' ? '#text' : c.tag)),
    },
  });

  ctx.objectRegistry.register(diagram, proteusId);
  return diagram;
}

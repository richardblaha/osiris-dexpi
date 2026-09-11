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
  EllipseArc,
  GraphicPrimitive,
} from '../../classes/graphics';
import type { RawNode } from '../raw';
import { childNamed, childrenNamed } from '../raw';
import { parsePosition, parseExtent } from './geometry';
import type { ParseContext } from '../core';

/**
 * Recognized inline graphical-primitive tags, matching pyDEXPI's own
 * `_make_graphical_primitive_parsers` (`proteus_parser/parser_factory.py`) plus
 * `Line` — real-world Proteus exports (e.g. SmartPID/AutoCAD-style, confirmed in
 * `samples/c01v01-hex.ex01.xml`) draw straight segments as `<Line>` rather than
 * `<PolyLine>`, which pyDEXPI's own parser does not recognize and silently drops.
 */
const PRIMITIVE_TAGS = new Set([
  'Line',
  'PolyLine',
  'Polygon',
  'Circle',
  'Ellipse',
  'EllipseArc',
  'TrimmedCurve',
  'Text',
]);

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

  if (node.tag === 'PolyLine' || node.tag === 'Line') {
    const coords = childrenNamed(node, 'Coordinate').map((c) => ({
      x: parseFloat(c.attrs.X || '0'),
      y: parseFloat(c.attrs.Y || '0'),
    }));
    const poly: PolyLine = { kind: 'polyline', points: coords };
    return poly;
  }

  if (node.tag === 'Polygon') {
    const coords = childrenNamed(node, 'Coordinate').map((c) => ({
      x: parseFloat(c.attrs.X || '0'),
      y: parseFloat(c.attrs.Y || '0'),
    }));
    const poly: Polygon = { kind: 'polygon', points: coords };
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

  // Proteus wraps a trimmed arc of a `<Circle>`/`<Ellipse>` in a `<TrimmedCurve
  // StartAngle= EndAngle=>` (or the DEXPI-native `<EllipseArc>`) — the wrapped
  // element carries the radii/position, the wrapper carries the angle range.
  if (node.tag === 'EllipseArc' || node.tag === 'TrimmedCurve') {
    const curve = childNamed(node, 'Circle') || childNamed(node, 'Ellipse');
    if (!curve) return undefined;
    const majorRadius =
      curve.tag === 'Circle'
        ? parseFloat(curve.attrs.Radius || '0')
        : parseFloat(curve.attrs.MajorRadius || '0');
    const minorRadius =
      curve.tag === 'Circle'
        ? parseFloat(curve.attrs.Radius || '0')
        : parseFloat(curve.attrs.MinorRadius || '0');
    const arc: EllipseArc = {
      majorRadius,
      minorRadius,
      startAngle: parseFloat(node.attrs.StartAngle || '0'),
      endAngle: parseFloat(node.attrs.EndAngle || '0'),
      position: parsePosition(curve) || pos,
    };
    return arc;
  }

  return undefined;
}

/**
 * Extracts graphical primitives embedded directly under a placed element (an
 * `<Equipment>`, `<PipingComponent>`, etc.), as opposed to a shared
 * `<ShapeCatalogue>` `<Shape>` definition. Mirrors pyDEXPI's
 * `EquipmentParser.drawing_pass`, which combines both sources — this covers the
 * inline-primitive half. Coordinates are left as-is (world/drawing units,
 * matching the element's own `<Extent>`).
 */
export function parseInlinePrimitives(node: RawNode): GraphicPrimitive[] {
  const primitives: GraphicPrimitive[] = [];
  for (const child of node.children) {
    if (typeof child === 'string') continue;
    if (!PRIMITIVE_TAGS.has(child.tag)) continue;
    const prim = parsePrimitive(child);
    if (prim) primitives.push(prim);
  }
  return primitives;
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

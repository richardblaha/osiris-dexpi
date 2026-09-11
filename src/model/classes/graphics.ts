/**
 * DEXPI Graphics and Drawing model.
 */

import type { DexpiObject, Ref } from './base';

export interface Point {
  x: number;
  y: number;
  z?: number;
}

export interface Position {
  location: Point;
  axis?: Point;
  reference?: Point;
}

export interface Extent {
  min: Point;
  max: Point;
}

/** Per-instance `<Scale X Y>` applied to a component's native 2D symbol footprint. */
export interface Scale {
  x: number;
  y: number;
}

export interface Presentation {
  r?: number;
  g?: number;
  b?: number;
  lineType?: number | string;
  lineWeight?: number;
}

export interface TextStringFormatSpecification {
  dependantAttribute?: string;
  dependantAttributeContents?: string;
  itemID?: string;
}

export interface Text {
  string: string;
  font?: string;
  height?: number;
  width?: number;
  justification?: string;
  textAngle?: number;
  position?: Position;
  presentation?: Presentation;
  formatSpecification?: TextStringFormatSpecification;
}

export interface TextTemplate {
  string: string;
  font?: string;
  height?: number;
  width?: number;
  justification?: string;
  position?: Position;
  presentation?: Presentation;
}

export interface PolyLine {
  points: Point[];
  presentation?: Presentation;
}

export interface Polygon {
  points: Point[];
  presentation?: Presentation;
}

export interface Circle {
  radius: number;
  position?: Position;
  presentation?: Presentation;
}

export interface Ellipse {
  majorRadius: number;
  minorRadius: number;
  position?: Position;
  presentation?: Presentation;
}

export interface EllipseArc {
  majorRadius: number;
  minorRadius: number;
  startAngle: number;
  endAngle: number;
  position?: Position;
  presentation?: Presentation;
}

export type GraphicPrimitive =
  | PolyLine
  | Polygon
  | Circle
  | Ellipse
  | EllipseArc
  | Text
  | TextTemplate;

export interface ShapeUsage extends DexpiObject {
  shape?: Ref;
  position?: Position;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  isMirrored?: boolean;
}

export interface Label extends DexpiObject {
  componentClass?: string;
  componentClassUri?: string;
  texts: Text[];
  lines?: PolyLine[];
  position?: Position;
}

export interface Static extends DexpiObject {
  elements: (ShapeUsage | GraphicPrimitive)[];
}

export interface RepresentationGroup extends DexpiObject {
  represents?: Ref;
  groups: (Static | Label | RepresentationGroup)[];
  nodePositions?: any[];
}

export interface DrawingBorder extends DexpiObject {
  elements: (GraphicPrimitive | Label | Static)[];
}

export interface Diagram extends DexpiObject {
  name?: string;
  minX?: number;
  minY?: number;
  maxX?: number;
  maxY?: number;
  backgroundColor?: Presentation;
  represents?: Ref;
  groups: (RepresentationGroup | Label | DrawingBorder | Static | any)[];
  nodePositions?: any[];
}

export interface Shape extends DexpiObject {
  componentName?: string;
  componentClass?: string;
  componentClassUri?: string;
  primitives: GraphicPrimitive[];
  attributes?: Record<string, any>;
}

export type TaggedPlantItemShape = Shape;
export type PipingComponentShape = Shape;
export type InstrumentShape = Shape;
export type ActuatingSystemComponentShape = Shape;

export interface ShapeCatalogue extends DexpiObject {
  name?: string;
  shapes: Shape[];
}

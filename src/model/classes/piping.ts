/**
 * DEXPI Piping Network System, Segments, Components, and Connections.
 */

import type { DexpiObject, CustomAttributeOwner, CustomAttribute, DexpiValue, Ref } from './base';
import type { Position, Extent, Scale } from './graphics';
import type { PipingNode } from './equipment';

export interface PipingConnection extends DexpiObject {
  sourceItem?: Ref;
  sourceNode?: Ref;
  targetItem?: Ref;
  targetNode?: Ref;
}

export interface Pipe extends PipingConnection, CustomAttributeOwner {
  centerLine?: { points: { x: number; y: number }[] };
}

export type DirectPipingConnection = PipingConnection;

export interface PipingNetworkSegmentItem extends DexpiObject, CustomAttributeOwner {
  dexpiClass?: string;
  componentClassUri?: string;
  nodes?: PipingNode[];
}

export interface PipingComponent extends PipingNetworkSegmentItem {
  dexpiClass: string;
  componentClassUri?: string;
  tagName?: string;
  nodes: PipingNode[];
  attributes: Record<string, DexpiValue>;
  customAttributes: CustomAttribute[];
  position?: Position;
  extent?: Extent;
  scale?: Scale;
  componentName?: string;
}

export interface PipeOffPageConnector extends PipingNetworkSegmentItem {
  dexpiClass?: string;
  componentClassUri?: string;
  referenceConnector?: Ref;
  connectedOffPageConnector?: Ref;
  label?: string;
  position?: Position;
  scale?: Scale;
  componentName?: string;
}

export interface PropertyBreak extends PipingNetworkSegmentItem {
  breakClassification?: string;
}

export interface PipingNetworkSegment extends DexpiObject, CustomAttributeOwner {
  dexpiClass?: string;
  componentClassUri?: string;
  segmentNumber?: string;
  fluidCode?: string;
  nominalDiameterRepresentation?: string;
  nominalDiameterNumericalValueRepresentation?: string;
  nominalDiameterStandard?: string;
  nominalDiameterTypeRepresentation?: string;
  pipingClassCode?: string;
  operatingTemperature?: any;
  insulationType?: string;
  insulationThickness?: any;
  heatTracingType?: string;
  slope?: string;
  flowDirection?: string;
  onHold?: string;
  sourceItem?: Ref;
  sourceNode?: Ref;
  targetItem?: Ref;
  targetNode?: Ref;
  connections: PipingConnection[];
  items: PipingNetworkSegmentItem[];
  centerLine?: { points: { x: number; y: number }[] };
}

export interface PipingNetworkSystem extends DexpiObject, CustomAttributeOwner {
  dexpiClass?: string;
  componentClassUri?: string;
  lineNumber?: string;
  fluidCode?: string;
  pipingClassCode?: string;
  nominalDiameterRepresentation?: string;
  segments: PipingNetworkSegment[];
  plantTrain?: Ref;
  plantSystem?: Ref;
  plantArea?: Ref;
  parentStructure?: Ref;
}

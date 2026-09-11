/**
 * DEXPI Equipment, Nozzle, and Chamber interfaces.
 */

import type { DexpiObject, CustomAttributeOwner, CustomAttribute, DexpiValue, Ref, RefList } from './base';
import type { Position, Extent, Scale } from './graphics';

export interface PipingNode extends DexpiObject {
  nodeNumber?: string | number;
  nodeType?: string;
  position?: Position;
}

export interface Nozzle extends DexpiObject, CustomAttributeOwner {
  dexpiClass?: string;
  componentClassUri?: string;
  subTagName?: string;
  nodes: PipingNode[];
  chamber?: Ref;
  position?: Position;
  nominalPressureNumericalValueRepresentation?: string;
  nominalPressureRepresentation?: string;
  nominalPressureStandard?: string;
  nominalPressureTypeRepresentation?: string;
}

export interface Chamber extends DexpiObject, CustomAttributeOwner {
  dexpiClass?: string;
  componentClassUri?: string;
  chamberFunction?: string;
  chamberNumber?: string;
}

export interface TaggedPlantItem extends DexpiObject, CustomAttributeOwner {
  tagName?: string;
  plantTrain?: Ref;
  plantSystem?: Ref;
  plantArea?: Ref;
  parentStructure?: Ref;
}

export interface Equipment extends TaggedPlantItem {
  dexpiClass: string;
  componentClassUri?: string;
  nozzles: Nozzle[];
  chambers: Chamber[];
  attributes: Record<string, DexpiValue>;
  customAttributes: CustomAttribute[];
  position?: Position;
  extent?: Extent;
  scale?: Scale;
  componentName?: string;
}

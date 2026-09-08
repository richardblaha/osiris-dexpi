/**
 * DEXPI Plant Structure items.
 */

import type { DexpiObject, CustomAttributeOwner, Ref } from './base';

export interface PlantStructureItem extends DexpiObject, CustomAttributeOwner {
  structureName?: string;
  structureIdentifier?: string;
  parentStructure?: Ref;
}

export type Enterprise = PlantStructureItem;
export type IndustrialComplex = PlantStructureItem;
export type PlantArea = PlantStructureItem;
export type PlantSection = PlantStructureItem;

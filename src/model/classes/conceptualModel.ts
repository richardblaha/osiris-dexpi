/**
 * DEXPI ConceptualModel container.
 */

import type { DexpiObject } from './base';
import type { ActuatingSystem, InstrumentationLoopFunction, ProcessInstrumentationFunction, ProcessSignalGeneratingSystem } from './instrumentation';
import type { MetaData } from './metaData';
import type { PipingNetworkSystem } from './piping';
import type { PlantStructureItem } from './plantStructure';
import type { TaggedPlantItem, Equipment } from './equipment';

export interface ConceptualModel extends DexpiObject {
  actuatingSystems: ActuatingSystem[];
  instrumentationLoopFunctions: InstrumentationLoopFunction[];
  metaData?: MetaData;
  pipingNetworkSystems: PipingNetworkSystem[];
  plantStructureItems: PlantStructureItem[];
  processInstrumentationFunctions: ProcessInstrumentationFunction[];
  processSignalGeneratingSystems: ProcessSignalGeneratingSystem[];
  taggedPlantItems: (Equipment | TaggedPlantItem)[];
}

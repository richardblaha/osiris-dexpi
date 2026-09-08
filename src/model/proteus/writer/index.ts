/**
 * ProteusWriter: Serializes a DexpiModel back into Proteus XML SchemaVersion 4.1.1.
 */

import type { DexpiModel } from '../../classes/dexpiModel';
import { buildRaw } from '../raw';
import { buildPlantModelNode } from './plantModel';

export class ProteusWriter {
  public static write(model: DexpiModel, includeProlog = true): string {
    const rootNode = buildPlantModelNode(model);
    return buildRaw([rootNode], includeProlog);
  }
}


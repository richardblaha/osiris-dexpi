/**
 * ProteusReader entry point.
 */

import { parseRaw } from '../raw';
import { ParseContext } from '../core';
import { parsePlantModel } from './plantModel';
import type { DexpiModel } from '../../classes/dexpiModel';
import type { ValidationIssue } from '../../../common/types';

export interface ProteusReadResult {
  model: DexpiModel;
  issues: ValidationIssue[];
}

export class ProteusReader {
  public static read(xml: string): ProteusReadResult {
    const rawNodes = parseRaw(xml);
    const plantModelNode = rawNodes.find((n) => n.tag === 'PlantModel');
    if (!plantModelNode) {
      throw new Error('PlantModel tag is missing in the DEXPI model. This information is required for a valid DEXPI model.');
    }

    const ctx = new ParseContext();
    const model = parsePlantModel(plantModelNode, ctx);

    return {
      model,
      issues: ctx.errorRegistry.toValidationIssues(),
    };
  }
}


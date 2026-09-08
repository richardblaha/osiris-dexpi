/**
 * Serializes typed attributes and customAttributes back into Proteus <GenericAttributes> XML nodes.
 */

import { SCHEMA } from '../../registry';
import type { CustomAttribute, DexpiValue, PhysicalQuantity } from '../../classes/base';
import type { MultiLanguageString, SingleLanguageString } from '../../classes/dataTypes';
import type { RawNode } from '../raw';
import { makeRawNode } from '../raw';

export function denormalizeAttributeName(fieldName: string): string {
  const capitalized = fieldName[0].toUpperCase() + fieldName.slice(1);
  if (capitalized.endsWith('AssignmentClass') || capitalized.endsWith('Specialization')) {
    return capitalized;
  }
  // Standard DEXPI convention is AssignmentClass suffix
  return `${capitalized}AssignmentClass`;
}

export function buildGenericAttributesNode(
  obj: any,
  className: string,
  setName = 'DexpiAttributes'
): RawNode | undefined {
  const attrNodes: RawNode[] = [];
  const emittedNames = new Set<string>();

  // 1. Custom attributes
  if (obj.customAttributes && Array.isArray(obj.customAttributes)) {
    for (const ca of obj.customAttributes as CustomAttribute[]) {
      if (!ca.attributeName || ca.value === undefined || ca.value === null) continue;

      const attrs: Record<string, string> = {
        Name: ca.attributeName,
        Value: String(ca.value),
        Format: ca.format || (typeof ca.value === 'number' ? 'double' : 'string'),
      };

      if (ca.attributeURI) attrs.AttributeURI = ca.attributeURI;
      if (ca.language) attrs.Language = ca.language;
      if (ca.unit) attrs.Units = ca.unit;

      attrNodes.push(makeRawNode('GenericAttribute', attrs));
      emittedNames.add(ca.attributeName);
    }
  }

  // 2. Typed fields from SCHEMA
  const classSchema = SCHEMA[className] || {};
  for (const [fieldName, fieldMeta] of Object.entries(classSchema)) {
    if (fieldMeta.category !== 'data') continue;
    const val = obj[fieldName] ?? (obj.attributes ? obj.attributes[fieldName] : undefined);
    if (val === undefined || val === null) continue;

    const rawName = denormalizeAttributeName(fieldName);
    if (emittedNames.has(rawName)) continue;

    if (Array.isArray(val)) {
      // MultiLanguageString
      for (const langItem of val as SingleLanguageString[]) {
        const attrs: Record<string, string> = {
          Name: rawName,
          Value: String(langItem.value),
          Format: 'string',
        };
        if (langItem.language) attrs.Language = langItem.language;
        attrNodes.push(makeRawNode('GenericAttribute', attrs));
      }
    } else if (typeof val === 'object' && 'unit' in val && 'value' in val) {
      // PhysicalQuantity
      const pq = val as PhysicalQuantity;
      if (pq.value !== null && pq.value !== undefined) {
        const attrs: Record<string, string> = {
          Name: rawName,
          Value: String(pq.value),
          Format: 'double',
          Units: pq.unit,
        };
        if (pq.uri) attrs.AttributeURI = pq.uri;
        attrNodes.push(makeRawNode('GenericAttribute', attrs));
      }
    } else {
      // Primitive or enum
      const format = typeof val === 'number' ? 'double' : typeof val === 'boolean' ? 'boolean' : 'string';
      attrNodes.push(
        makeRawNode('GenericAttribute', {
          Name: rawName,
          Value: String(val),
          Format: format,
        })
      );
    }
  }

  if (attrNodes.length === 0) return undefined;

  return makeRawNode(
    'GenericAttributes',
    {
      Set: setName,
      Number: String(attrNodes.length),
    },
    attrNodes
  );
}


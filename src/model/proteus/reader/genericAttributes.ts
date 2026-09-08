/**
 * GenericAttribute parsing and mapping to typed fields or customAttributes.
 * Ports pyDEXPI parser_modules.py:126-218 with lossless customAttributes fallback.
 */

import { SCHEMA } from '../../registry';
import type { CustomAttribute, DexpiValue, PhysicalQuantity } from '../../classes/base';
import type { MultiLanguageString, SingleLanguageString } from '../../classes/dataTypes';
import type { RawNode } from '../raw';
import { childrenNamed } from '../raw';

export interface ParsedAttributesResult {
  typedAttributes: Record<string, DexpiValue>;
  customAttributes: CustomAttribute[];
  rawAttributeSets: RawNode[];
}

export function normalizeAttributeName(rawName: string): string {
  let name = rawName;
  if (name.endsWith('AssignmentClass')) {
    name = name.slice(0, -'AssignmentClass'.length);
  } else if (name.endsWith('Specialization')) {
    name = name.slice(0, -'Specialization'.length);
  }
  if (name.length === 0) return rawName;
  return name[0].toLowerCase() + name.slice(1);
}

export function parseGenericAttributeSets(
  containerNode: RawNode,
  className: string
): ParsedAttributesResult {
  const typedAttributes: Record<string, DexpiValue> = {};
  const customAttributes: CustomAttribute[] = [];
  const rawAttributeSets = childrenNamed(containerNode, 'GenericAttributes');

  const classSchema = SCHEMA[className] || {};
  const multiLanguageMap: Record<string, SingleLanguageString[]> = {};

  for (const setNode of rawAttributeSets) {
    const setName = setNode.attrs.Set;
    const attrNodes = childrenNamed(setNode, 'GenericAttribute');

    for (const attrNode of attrNodes) {
      const rawName = attrNode.attrs.Name;
      if (!rawName) continue;

      const rawValue = attrNode.attrs.Value;
      const format = attrNode.attrs.Format;
      const language = attrNode.attrs.Language;
      const attributeURI = attrNode.attrs.AttributeURI;
      const unit = attrNode.attrs.Units || attrNode.attrs.Unit;

      const fieldName = normalizeAttributeName(rawName);
      const fieldMeta = classSchema[fieldName];

      if (fieldMeta && fieldMeta.category === 'data') {
        if (rawValue === undefined || rawValue === null) continue;

        const expectedType = fieldMeta.type || 'string';

        if (expectedType.includes('MultiLanguageString') || language) {
          if (!multiLanguageMap[fieldName]) multiLanguageMap[fieldName] = [];
          multiLanguageMap[fieldName].push({
            language,
            value: rawValue,
          });
        } else if (expectedType === 'int' || expectedType === 'integer') {
          const num = parseInt(rawValue, 10);
          typedAttributes[fieldName] = isNaN(num) ? rawValue : num;
        } else if (expectedType === 'float' || expectedType === 'double') {
          const num = parseFloat(rawValue);
          typedAttributes[fieldName] = isNaN(num) ? rawValue : num;
        } else if (expectedType === 'bool' || expectedType === 'boolean') {
          typedAttributes[fieldName] = rawValue.toLowerCase() === 'true' || rawValue === '1';
        } else if (
          expectedType.includes('Nullable') ||
          expectedType.includes('Length') ||
          expectedType.includes('Pressure') ||
          expectedType.includes('Temperature') ||
          unit
        ) {
          // PhysicalQuantity
          const num = parseFloat(rawValue);
          const pq: PhysicalQuantity = {
            value: isNaN(num) ? null : num,
            unit: unit || '',
            uri: attributeURI || '',
          };
          typedAttributes[fieldName] = pq;
        } else {
          // Default string / enum classification
          typedAttributes[fieldName] = rawValue;
        }
      } else {
        // Unmatched -> lossless customAttribute
        let val: DexpiValue = rawValue ?? null;
        if (format === 'double' || format === 'float') {
          const n = parseFloat(String(rawValue));
          if (!isNaN(n)) val = n;
        } else if (format === 'integer' || format === 'int') {
          const n = parseInt(String(rawValue), 10);
          if (!isNaN(n)) val = n;
        } else if (format === 'boolean') {
          val = String(rawValue).toLowerCase() === 'true';
        }

        customAttributes.push({
          attributeName: rawName,
          attributeURI,
          value: val,
          format,
          language,
          set: setName,
          unit,
        });
      }
    }
  }

  // Merge multi-language strings
  for (const [fName, list] of Object.entries(multiLanguageMap)) {
    typedAttributes[fName] = list;
  }

  return { typedAttributes, customAttributes, rawAttributeSets };
}


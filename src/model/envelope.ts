/**
 * pyDEXPI JSON envelope serializer and deserializer.
 * Serializes between acyclic Plain-JSON envelope (composition / reference / data)
 * and the DexpiModel tree.
 */

import { classForUri, uriForClass } from './uris';
import { SCHEMA } from './registry';
import type { DexpiObject, PhysicalQuantity, Ref, RefList } from './classes/base';
import type { DexpiModel } from './classes/dexpiModel';
import type { SingleLanguageString } from './classes/dataTypes';

export interface EnvelopeNode {
  uri: string;
  id?: string;
  composition?: Record<string, EnvelopeNode | EnvelopeNode[] | null>;
  reference?: Record<string, string | string[] | null>;
  data?: Record<string, any>;
}

export type DexpiEnvelope = EnvelopeNode;

function isDexpiObject(val: unknown): val is DexpiObject {
  return (
    typeof val === 'object' &&
    val !== null &&
    'id' in val &&
    typeof (val as any).id === 'string' &&
    'uri' in val &&
    typeof (val as any).uri === 'string'
  );
}

function isPhysicalQuantity(val: unknown): val is PhysicalQuantity {
  return (
    typeof val === 'object' &&
    val !== null &&
    'unit' in val &&
    'value' in val &&
    'uri' in val &&
    typeof (val as any).unit === 'string' &&
    typeof (val as any).uri === 'string'
  );
}

function isSingleLanguageString(val: unknown): val is SingleLanguageString {
  return (
    typeof val === 'object' &&
    val !== null &&
    'value' in val &&
    typeof (val as any).value === 'string' &&
    !('uri' in val) &&
    !('id' in val)
  );
}

/**
 * Converts a pyDEXPI JSON envelope into a DexpiModel domain model.
 */
export function fromEnvelope(envelope: DexpiEnvelope): DexpiModel {
  return fromEnvelopeNode(envelope) as DexpiModel;
}

export function fromEnvelopeNode(node: EnvelopeNode): DexpiObject {
  const className = classForUri(node.uri) || 'DexpiObject';
  const obj: any = {
    id: node.id || '',
    uri: node.uri,
  };

  if (className && className !== 'DexpiObject') {
    obj.dexpiClass = className;
  }

  // 1. Unpack composition
  if (node.composition) {
    for (const [key, compVal] of Object.entries(node.composition)) {
      if (compVal === null || compVal === undefined) {
        obj[key] = null;
      } else if (Array.isArray(compVal)) {
        obj[key] = compVal.map((item) => fromEnvelopeNode(item));
      } else {
        obj[key] = fromEnvelopeNode(compVal);
      }
    }
  }

  // 2. Unpack references
  if (node.reference) {
    for (const [key, refVal] of Object.entries(node.reference)) {
      obj[key] = refVal;
    }
  }

  // 3. Unpack data attributes
  if (node.data) {
    for (const [key, dataVal] of Object.entries(node.data)) {
      obj[key] = unpackDataValue(dataVal);
    }
  }

  return obj as DexpiObject;
}

function unpackDataValue(val: any): any {
  if (val === null || val === undefined) return val;

  if (Array.isArray(val)) {
    return val.map(unpackDataValue);
  }

  if (typeof val === 'object') {
    // Check if it represents a PhysicalQuantity
    if (val.uri && val.data && typeof val.data === 'object' && 'unit' in val.data) {
      return {
        uri: val.uri,
        unit: val.data.unit,
        value: val.data.value,
      };
    }
    // Check if it represents a SingleLanguageString
    if (val.uri && val.data && typeof val.data === 'object' && 'value' in val.data) {
      return {
        language: val.data.language,
        value: val.data.value,
      };
    }
    // Nested data model (e.g. dataTypes)
    if (val.uri && val.data) {
      return unpackDataValue(val.data);
    }
    const unpackedObj: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      unpackedObj[k] = unpackDataValue(v);
    }
    return unpackedObj;
  }

  return val;
}

/**
 * Converts a DexpiModel into a pyDEXPI JSON envelope.
 */
export function toEnvelope(model: DexpiModel): DexpiEnvelope {
  return toEnvelopeNode(model);
}

export function toEnvelopeNode(obj: DexpiObject): EnvelopeNode {
  const className = (obj as any).dexpiClass || (obj.uri ? classForUri(obj.uri) : undefined) || 'DexpiObject';
  const classSchema = SCHEMA[className] || {};

  const composition: Record<string, any> = {};
  const reference: Record<string, any> = {};
  const data: Record<string, any> = {};

  // Find all keys in obj
  const knownKeys = new Set([
    ...Object.keys(classSchema),
    ...Object.keys(obj).filter((k) => !['_proteus', 'dexpiClass'].includes(k)),
  ]);

  for (const key of knownKeys) {
    if (key === 'id' || key === 'uri' || key === 'dexpiClass' || key === '_proteus') continue;

    const val = (obj as any)[key];
    const fieldMeta = classSchema[key];

    const category =
      fieldMeta?.category ||
      (isDexpiObject(val) || (Array.isArray(val) && val.length > 0 && isDexpiObject(val[0]))
        ? 'composition'
        : undefined);

    if (category === 'composition') {
      if (val === null || val === undefined) {
        if (fieldMeta?.required) composition[key] = null;
      } else if (Array.isArray(val)) {
        composition[key] = val.map((item) => toEnvelopeNode(item));
      } else if (isDexpiObject(val)) {
        composition[key] = toEnvelopeNode(val);
      } else {
        composition[key] = val;
      }
    } else if (category === 'reference') {
      if (val !== undefined) {
        reference[key] = val;
      }
    } else if (category === 'data') {
      if (val !== undefined) {
        data[key] = packageDataValue(val);
      }
    } else if (val !== undefined) {
      // Uncategorized: infer based on value type
      if (isDexpiObject(val)) {
        composition[key] = toEnvelopeNode(val);
      } else if (Array.isArray(val) && val.every(isDexpiObject)) {
        composition[key] = val.map(toEnvelopeNode);
      } else {
        data[key] = packageDataValue(val);
      }
    }
  }

  const envelope: EnvelopeNode = {
    uri: obj.uri || uriForClass(className),
  };
  if (obj.id) envelope.id = obj.id;
  if (Object.keys(composition).length > 0) envelope.composition = composition;
  if (Object.keys(reference).length > 0) envelope.reference = reference;
  if (Object.keys(data).length > 0) envelope.data = data;

  return envelope;
}

function packageDataValue(val: any): any {
  if (val === null || val === undefined) return val;

  if (Array.isArray(val)) {
    return val.map(packageDataValue);
  }

  if (isPhysicalQuantity(val)) {
    return {
      uri: val.uri,
      data: {
        unit: val.unit,
        value: val.value,
      },
    };
  }

  if (isSingleLanguageString(val)) {
    return {
      uri: 'https://pyDEXPI.org/schemas/pydexpi_1_3/singleLanguageString.py',
      data: {
        language: val.language ?? null,
        value: val.value,
      },
    };
  }

  if (typeof val === 'object') {
    const res: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      res[k] = packageDataValue(v);
    }
    return res;
  }

  return val;
}

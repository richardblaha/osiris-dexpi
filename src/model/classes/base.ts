/**
 * Core DEXPI primitives, envelope types, and base interfaces.
 */

import type { MultiLanguageString, SingleLanguageString } from './dataTypes';

export type Ref = string;
export type RefList = string[];

export interface ProteusPassthrough {
  attrs?: Record<string, string>;
  extra?: any[];
  childOrder?: string[];
}

export interface DexpiObject {
  id: string;
  uri: string;
  proteusId?: string;
  _proteus?: ProteusPassthrough;
}

export interface PhysicalQuantity {
  value: number | null;
  unit: string;
  uri: string;
}

export type DexpiValue =
  | string
  | number
  | boolean
  | null
  | SingleLanguageString
  | MultiLanguageString
  | PhysicalQuantity
  | CustomAttribute
  | Record<string, unknown>
  | DexpiValue[];

export interface CustomAttribute {
  attributeName: string;
  attributeURI?: string;
  value: DexpiValue;
  format?: string;
  language?: string;
  set?: string;
  unit?: string;
}

export interface CustomAttributeOwner {
  customAttributes?: CustomAttribute[];
}

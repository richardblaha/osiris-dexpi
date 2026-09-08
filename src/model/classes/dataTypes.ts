/**
 * DEXPI string data types.
 */

export interface SingleLanguageString {
  language?: string;
  value: string;
}

export type MultiLanguageString = SingleLanguageString[];

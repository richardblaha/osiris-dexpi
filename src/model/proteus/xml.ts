/**
 * Fast-xml-parser configuration for Proteus XML.
 * Preserves tag order, casing, whitespace, and attributes.
 */

import { XMLParser, XMLBuilder } from 'fast-xml-parser';

export const PROTEUS_PARSER_OPTIONS = {
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: '',
  parseTagValue: false,
  trimValues: false,
  commentPropName: '#comment',
};

export const PROTEUS_BUILDER_OPTIONS = {
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: '',
  format: true,
  indentBy: '  ',
  suppressEmptyNode: false,
  commentPropName: '#comment',
};

export function createProteusParser(): XMLParser {
  return new XMLParser(PROTEUS_PARSER_OPTIONS);
}

export function createProteusBuilder(): XMLBuilder {
  return new XMLBuilder(PROTEUS_BUILDER_OPTIONS);
}


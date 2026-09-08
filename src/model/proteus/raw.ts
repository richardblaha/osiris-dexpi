/**
 * Normalized RawNode representation and helpers for Proteus XML.
 */

import { createProteusParser, createProteusBuilder } from './xml';

export interface RawNode {
  tag: string;
  attrs: Record<string, string>;
  children: (RawNode | string)[];
}

export function isRawNode(item: any): item is RawNode {
  return (
    typeof item === 'object' &&
    item !== null &&
    typeof item.tag === 'string' &&
    typeof item.attrs === 'object' &&
    Array.isArray(item.children)
  );
}

/**
 * Converts fast-xml-parser preserveOrder output to a normalized RawNode tree.
 */
export function fromFastXml(orderedList: any[]): (RawNode | string)[] {
  const result: (RawNode | string)[] = [];

  for (const item of orderedList) {
    if (typeof item === 'string') {
      result.push(item);
      continue;
    }

    if (typeof item !== 'object' || item === null) continue;

    if ('#text' in item) {
      const text = String(item['#text']);
      if (text.trim().length > 0) {
        result.push(text);
      }
      continue;
    }

    const attrs = item[':@'] ? { ...item[':@'] } : {};
    const tag = Object.keys(item).find((k) => k !== ':@' && !k.startsWith('?'));

    if (!tag) continue;

    const rawChildren = Array.isArray(item[tag]) ? item[tag] : [];
    const children = fromFastXml(rawChildren);

    result.push({
      tag,
      attrs,
      children,
    });
  }

  return result;
}

/**
 * Converts a normalized RawNode tree into fast-xml-parser preserveOrder format.
 */
export function toFastXml(nodes: (RawNode | string)[]): any[] {
  const result: any[] = [];

  for (const node of nodes) {
    if (typeof node === 'string') {
      result.push({ '#text': node });
      continue;
    }

    const item: Record<string, any> = {};
    if (node.attrs && Object.keys(node.attrs).length > 0) {
      item[':@'] = { ...node.attrs };
    }
    item[node.tag] = toFastXml(node.children);
    result.push(item);
  }

  return result;
}

export function parseRaw(xml: string): RawNode[] {
  const parser = createProteusParser();
  const parsed = parser.parse(xml);
  return fromFastXml(parsed).filter(isRawNode);
}

export function buildRaw(nodes: RawNode[], includeProlog = true): string {
  const builder = createProteusBuilder();
  const fastXml = toFastXml(nodes);
  const xml = builder.build(fastXml);
  if (includeProlog && !xml.startsWith('<?xml')) {
    return `<?xml version="1.0" encoding="UTF-8"?>\n${xml}`;
  }
  return xml;
}

// Helper methods on RawNode
export function childNamed(node: RawNode, tag: string): RawNode | undefined {
  return node.children.find((c): c is RawNode => isRawNode(c) && c.tag === tag);
}

export function childrenNamed(node: RawNode, tag: string): RawNode[] {
  return node.children.filter((c): c is RawNode => isRawNode(c) && c.tag === tag);
}

export function attr(node: RawNode, name: string): string | undefined {
  return node.attrs ? node.attrs[name] : undefined;
}

export function textOf(node: RawNode): string {
  return node.children
    .filter((c): c is string => typeof c === 'string')
    .join('')
    .trim();
}

export function makeRawNode(
  tag: string,
  attrs: Record<string, string> = {},
  children: (RawNode | string)[] = []
): RawNode {
  return { tag, attrs, children };
}

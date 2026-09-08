// Vendored draw.io P&ID stencils (Apache-2.0). See vendor/NOTICE.md.
import apparatusElementsXml from './vendor/apparatus_elements.xml';
import compressorsXml from './vendor/compressors.xml';
import fittingsXml from './vendor/fittings.xml';
import flowSensorsXml from './vendor/flow_sensors.xml';
import heatExchangersXml from './vendor/heat_exchangers.xml';
import pipingXml from './vendor/piping.xml';
import pumpsXml from './vendor/pumps.xml';
import pumpsIsoXml from './vendor/pumps_iso.xml';
import valvesXml from './vendor/valves.xml';
import vesselsXml from './vendor/vessels.xml';
// Locally authored ISA-5.1 instrument bubbles (no baked tag text).
import instrumentsXml from './local/instruments.xml';

export const STENCIL_FILES: Array<{ key: string; xml: string }> = [
  { key: 'apparatus', xml: apparatusElementsXml },
  { key: 'compressors', xml: compressorsXml },
  { key: 'fittings', xml: fittingsXml },
  { key: 'flow_sensors', xml: flowSensorsXml },
  { key: 'heat_exchangers', xml: heatExchangersXml },
  { key: 'piping', xml: pipingXml },
  { key: 'pumps', xml: pumpsXml },
  { key: 'pumps_iso', xml: pumpsIsoXml },
  { key: 'valves', xml: valvesXml },
  { key: 'vessels', xml: vesselsXml },
  { key: 'instruments', xml: instrumentsXml },
];

export function stencilSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** `pid.<file>.<slug>` id for a stencil shape. */
export function stencilId(fileKey: string, shapeName: string): string {
  return `pid.${fileKey}.${stencilSlug(shapeName)}`;
}

let shapeXmlById: Map<string, string> | null = null;

/**
 * Parses every bundled stencil file once and returns a map of stencil id → the
 * raw `<shape>` XML string. Browser-only (needs `DOMParser` / `XMLSerializer`).
 */
export function stencilShapeXmlMap(): Map<string, string> {
  if (shapeXmlById) return shapeXmlById;
  const map = new Map<string, string>();
  const parser = new DOMParser();
  const serializer = new XMLSerializer();
  for (const { key, xml } of STENCIL_FILES) {
    const doc = parser.parseFromString(xml, 'text/xml');
    const shapes = doc.getElementsByTagName('shape');
    for (let i = 0; i < shapes.length; i++) {
      const shapeEl = shapes[i];
      const name = shapeEl.getAttribute('name');
      if (!name) continue;
      map.set(stencilId(key, name), serializer.serializeToString(shapeEl));
    }
  }
  shapeXmlById = map;
  return map;
}

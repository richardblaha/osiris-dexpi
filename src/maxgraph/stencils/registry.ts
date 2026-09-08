import { StencilShape, StencilShapeRegistry } from '@maxgraph/core';
import { STENCIL_FILES, stencilId, stencilShapeXmlMap } from './sources';

export { stencilId } from './sources';

let registered = false;
let registeredCount = 0;

/**
 * Parses every bundled P&ID stencil file and registers each `<shape>` with
 * {@link StencilShapeRegistry} under a `pid.<file>.<slug>` id. Idempotent.
 */
export function registerPidStencils(): number {
  if (registered) return registeredCount;

  const parser = new DOMParser();
  for (const { key, xml } of STENCIL_FILES) {
    const doc = parser.parseFromString(xml, 'text/xml');
    const shapes = doc.getElementsByTagName('shape');
    for (let i = 0; i < shapes.length; i++) {
      const shapeEl = shapes[i];
      const name = shapeEl.getAttribute('name');
      if (!name) continue;
      StencilShapeRegistry.add(stencilId(key, name), new StencilShape(shapeEl));
      registeredCount++;
    }
  }

  registered = true;
  return registeredCount;
}

/** Raw `<shape>` XML for a registered stencil id — used for palette thumbnails. */
export function getStencilXml(id: string): string | undefined {
  return stencilShapeXmlMap().get(id);
}

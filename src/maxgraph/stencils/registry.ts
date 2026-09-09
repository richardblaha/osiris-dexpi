import { STENCIL_FILES, stencilId, stencilShapeXmlMap } from './sources';

export { stencilId } from './sources';

export interface StencilDefinition {
  id: string;
  name: string;
  categoryKey: string;
  xml: string;
}

export class StencilShapeRegistry {
  private static registry = new Map<string, StencilDefinition>();

  public static add(id: string, def: StencilDefinition): void {
    this.registry.set(id, def);
  }

  public static get(id: string): StencilDefinition | undefined {
    return this.registry.get(id);
  }

  public static clear(): void {
    this.registry.clear();
  }

  public static size(): number {
    return this.registry.size;
  }
}

let registered = false;
let registeredCount = 0;

/**
 * Parses bundled P&ID stencil files and registers each `<shape>` with StencilShapeRegistry.
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
      const id = stencilId(key, name);
      StencilShapeRegistry.add(id, {
        id,
        name,
        categoryKey: key,
        xml: shapeEl.outerHTML || xml,
      });
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

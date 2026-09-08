/**
 * Root DEXPI Model interface.
 */

import type { DexpiObject } from './base';
import type { ConceptualModel } from './conceptualModel';
import type { Diagram, ShapeCatalogue } from './graphics';

export interface DexpiModel extends DexpiObject {
  conceptualModel: ConceptualModel;
  diagram?: Diagram;
  shapeCatalogues: ShapeCatalogue[];
  exportDateTime?: string;
  originatingSystemName?: string;
  originatingSystemVendorName?: string;
  originatingSystemVersion?: string;
}

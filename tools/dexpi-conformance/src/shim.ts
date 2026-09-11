/**
 * Installs a minimal browser DOM surface on `globalThis` so the editor's
 * SVG-export code path (`src/webview/exportSvg.ts`, `src/maxgraph/stencils/*`)
 * runs unchanged under Node. Only `DOMParser` / `XMLSerializer` are needed —
 * the stencil code uses `getElementsByTagName`, attributes and serialisation.
 *
 * Import this module for its side effect BEFORE importing any editor source.
 */
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

const g = globalThis as Record<string, unknown>;
if (typeof g.DOMParser === 'undefined') g.DOMParser = DOMParser;
if (typeof g.XMLSerializer === 'undefined') g.XMLSerializer = XMLSerializer;

export {};

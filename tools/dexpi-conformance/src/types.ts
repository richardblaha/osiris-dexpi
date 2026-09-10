/** Shared types for the conformance suite. */

export type CorpusClassification =
  | 'proteus-graphics' // pyDEXPI produces a geometry-rich reference → in the PASS/FAIL corpus
  | 'empty-reference' // parses + has positions, but pyDEXPI's render is near-empty
  //                     (shapes live in an external ShapeCatalogue) → structural-only
  | 'semantic-only' // parses, but carries no geometry at all → excluded
  | 'unrenderable'; // parser/data error even after the wrapper's fixes → excluded

export interface CorpusEntry {
  /** stable id: `<version>/<task>/<file-slug>`, e.g. `1.2/E01/e01v01-aud-ex01` */
  id: string;
  /** repo-relative path to the .xml */
  path: string;
  /** DEXPI spec version folder: "1.2" | "1.3" */
  version: string;
  /** task code parsed from the containing folder, e.g. "E01", "I03", "C01", "P02" */
  task: string;
  classification: CorpusClassification;
  /** reason string when classification is semantic-only / unrenderable */
  reason?: string;
  /** repo-relative path to an official reference SVG shipped next to the sample, if any */
  officialSvg?: string;
  /** true once pyDEXPI (via the wrapper) has actually produced a reference SVG */
  referenceRendered?: boolean;
}

export interface CorpusManifest {
  toolVersion: string;
  counts: Record<CorpusClassification, number>;
  entries: CorpusEntry[];
}

/** Normalised, renderer-agnostic description of a diagram, extracted from a parsed model. */
export interface DiagramModel {
  source: 'ours' | 'reference';
  symbols: DiagramSymbol[];
  connections: DiagramConnection[];
  labels: DiagramLabel[];
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
}

export interface DiagramSymbol {
  id: string;
  dexpiClass: string;
  kind: string;
  cx: number;
  cy: number;
  w: number;
  h: number;
  rotation: number;
  mirrored: boolean;
  tag?: string;
}

export interface DiagramConnection {
  id: string;
  kind: 'pipe' | 'signal' | 'unknown';
  fromSymbol?: string;
  toSymbol?: string;
  polyline: Array<{ x: number; y: number }>;
}

export interface DiagramLabel {
  text: string;
  x: number;
  y: number;
  ownerId?: string;
}

export type FindingCategory =
  | 'symbol-missing'
  | 'symbol-extra'
  | 'symbol-class-mismatch'
  | 'position-off'
  | 'size-off'
  | 'rotation-mismatch'
  | 'connection-missing'
  | 'connection-extra'
  | 'label-mismatch'
  | 'style-diff';

export const FINDING_SEVERITY: Record<FindingCategory, number> = {
  'symbol-missing': 100,
  'symbol-extra': 90,
  'symbol-class-mismatch': 80,
  'position-off': 60,
  'rotation-mismatch': 50,
  'connection-missing': 45,
  'connection-extra': 40,
  'size-off': 20,
  'label-mismatch': 15,
  'style-diff': 5,
};

export interface Finding {
  category: FindingCategory;
  severity: number;
  message: string;
  refId?: string;
  ourId?: string;
}

export type RowStatus = 'PASS' | 'WARN' | 'FAIL' | 'NO-REFERENCE';

export interface ResultRow {
  id: string;
  status: RowStatus;
  structuralScore: number; // 0..1, 1 == identical
  visualMismatch?: number; // 0..1
  visualWayOff?: boolean;
  findings: Finding[];
  counts: {
    refSymbols: number;
    ourSymbols: number;
    refConnections: number;
    ourConnections: number;
  };
}

export interface RunResults {
  generatedAt: string;
  config: unknown;
  rows: ResultRow[];
  summary: {
    total: number;
    pass: number;
    warn: number;
    fail: number;
    noReference: number;
    meanStructuralScore: number;
  };
}

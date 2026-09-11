/**
 * Visual canvas projection from DexpiModel to PidView.
 * Translates DEXPI domain model into flattened, canvas-ready PidView data structure.
 * Handles Y-flip (DEXPI Y-up millimetres -> canvas Y-down coordinates).
 */

import type { DexpiModel } from '../classes/dexpiModel';
import type { TaggedPlantItem, Equipment, Nozzle } from '../classes/equipment';
import type { PipingComponent, Pipe } from '../classes/piping';
import type { ProcessInstrumentationFunction, ActuatingSystem } from '../classes/instrumentation';
import type { Shape, GraphicPrimitive } from '../classes/graphics';
import { boundsOfPrimitives } from '../shapeGeometry';

export type PidNodeKind =
  | 'equipment'
  | 'nozzle'
  | 'pipingComponent'
  | 'instrument'
  | 'actuator'
  | 'offPageConnector';

export type PidEdgeKind = 'pipe' | 'signal' | 'directConnection';

export interface PidViewNode {
  id: string;
  kind: PidNodeKind;
  dexpiClass: string;
  componentClassUri?: string;
  /** Proteus `ComponentName` (e.g. "GLOBE_VALVE_SHAPE") — the most precise signal for which symbol to draw. */
  componentName?: string;
  /** `<ShapeCatalogue>` `Shape` matched by `componentName`, if the document defines one — drawn scaled-to-fit `w`x`h`. */
  symbolShape?: Shape;
  /** Graphical primitives embedded directly on this element, already in world units matching `x/y/w/h` — drawn as-is (translate only). */
  symbolPrimitives?: GraphicPrimitive[];
  tagName: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
  mirrored?: boolean;
  parentId?: string;
  portRel?: { x: number; y: number };
  selected?: boolean;
  hovered?: boolean;
  attributes: Record<string, string>;
  sourcePath?: string[];
}

export interface PidViewEdge {
  id: string;
  kind: PidEdgeKind;
  lineKind?: PidEdgeKind;
  dexpiClass: string;
  sourceId: string;
  sourceNode?: string;
  targetId: string;
  targetNode?: string;
  waypoints: { x: number; y: number }[];
  label?: string;
  fluidCode?: string;
  attributes?: Record<string, string>;
  sourcePath?: string[];
}

export interface PidViewLabel {
  id: string;
  text: string;
  x: number;
  y: number;
  parentId?: string;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PidView {
  nodes: PidViewNode[];
  edges: PidViewEdge[];
  labels: PidViewLabel[];
  bounds: Rect;
}

function getDefaultWidth(dexpiClass: string): number {
  switch (dexpiClass) {
    case 'CentrifugalPump':
    case 'PositiveDisplacementPump':
    case 'ReciprocatingPump':
      return 70;
    case 'StorageTank':
    case 'Tank':
      return 110;
    case 'VerticalVessel':
      return 90;
    case 'HorizontalVessel':
      return 140;
    case 'DistillationColumn':
      return 80;
    case 'PlateHeatExchanger':
    case 'TubularHeatExchanger':
    case 'ShellAndTubeHeatExchanger':
      return 100;
    case 'PipingComponent':
    case 'GlobeValve':
    case 'GateValve':
    case 'BallValve':
    case 'ButterflyValve':
    case 'CheckValve':
      return 44;
    case 'ProcessInstrumentationFunction':
      return 44;
    case 'ControlledActuator':
    case 'ActuatingSystem':
      return 44;
    default:
      return 80;
  }
}

/**
 * Piping components (valves, tees, reducers...) and actuators almost never carry
 * an `<Extent>` in Proteus XML — instead each carries a per-instance `<Scale X Y>`
 * applied to a small, roughly-universal native 2D symbol footprint. Confirmed by
 * cross-checking a real GlobeValve's `<Scale X="0.4">` against the 4mm gap between
 * its two connection-point `<Position>`s (10 * 0.4 = 4), and a ControlledActuator's
 * reference stencil geometry (an 18x9 bounding box). Without this, components
 * lacking Extent fell back to `getDefaultWidth/Height`'s much larger constants
 * (tuned for equipment) and rendered many times too big, overlapping everything.
 */
const NOMINAL_PIPING_SYMBOL_W = 10;
const NOMINAL_PIPING_SYMBOL_H = 5;
const NOMINAL_ACTUATOR_SYMBOL_W = 18;
const NOMINAL_ACTUATOR_SYMBOL_H = 9;
const NOMINAL_INSTRUMENT_SYMBOL_SIZE = 10;

/**
 * Native (pre-`<Scale>`) footprints for equipment stencils, cross-checked against
 * a real reference render's own shape geometry (e.g. PLATE_TYPE_HEAT_EXCHANGER_SHAPE
 * spans 30x10 before its per-instance Scale is applied). Used whenever an
 * Equipment has no `<Extent>` of its own — which Proteus/DEXPI exports commonly
 * omit in favor of `<Scale>`, just like piping components and actuators.
 */
function getNominalEquipmentSize(dexpiClass: string): { w: number; h: number } {
  switch (dexpiClass) {
    case 'CentrifugalPump':
    case 'PositiveDisplacementPump':
    case 'ReciprocatingPump':
      return { w: 15, h: 15 };
    case 'StorageTank':
    case 'Tank':
    case 'VerticalVessel':
      return { w: 20, h: 30 };
    case 'HorizontalVessel':
      return { w: 30, h: 20 };
    case 'DistillationColumn':
      return { w: 20, h: 60 };
    case 'PlateHeatExchanger':
      return { w: 30, h: 10 };
    case 'TubularHeatExchanger':
    case 'ShellAndTubeHeatExchanger':
      return { w: 35, h: 10 };
    default:
      return { w: 20, h: 20 };
  }
}

/**
 * Resolves a node's placed size. `<Extent>` (if present) always wins. Failing
 * that: primitives embedded directly on the element (`inlineNative`) are
 * already in final world units, used as-is; a `<ShapeCatalogue>` `Shape`'s own
 * bounding box (`catalogNative`) is in the shape's native pre-`<Scale>` units
 * and gets multiplied by the instance's `<Scale>`, mirroring pyDEXPI's
 * `ShapeUsage.scaleX/scaleY`. With neither, fall back to a generic per-class
 * default box (not shape imagery — just a layout-sized placeholder).
 */
function resolveScaledSize(
  extentW: number | undefined,
  extentH: number | undefined,
  instanceScale: { x: number; y: number } | undefined,
  catalogNative: { w: number; h: number } | undefined,
  inlineNative: { w: number; h: number } | undefined,
  nominal: { w: number; h: number },
  fallback: { w: number; h: number },
  U: number
): { w: number; h: number } {
  if (extentW !== undefined && extentH !== undefined) return { w: extentW, h: extentH };
  if (inlineNative) return { w: inlineNative.w * U, h: inlineNative.h * U };
  const nativeSize = catalogNative ?? nominal;
  if (instanceScale) {
    return { w: nativeSize.w * instanceScale.x * U, h: nativeSize.h * instanceScale.y * U };
  }
  if (catalogNative) {
    return { w: catalogNative.w * U, h: catalogNative.h * U };
  }
  return { w: fallback.w * U, h: fallback.h * U };
}

function getDefaultHeight(dexpiClass: string): number {
  switch (dexpiClass) {
    case 'CentrifugalPump':
    case 'PositiveDisplacementPump':
    case 'ReciprocatingPump':
      return 70;
    case 'StorageTank':
    case 'Tank':
      return 150;
    case 'VerticalVessel':
      return 180;
    case 'HorizontalVessel':
      return 90;
    case 'DistillationColumn':
      return 240;
    case 'PlateHeatExchanger':
      return 120;
    case 'TubularHeatExchanger':
    case 'ShellAndTubeHeatExchanger':
      return 70;
    case 'PipingComponent':
    case 'GlobeValve':
    case 'GateValve':
    case 'BallValve':
    case 'ButterflyValve':
    case 'CheckValve':
      return 30;
    case 'ProcessInstrumentationFunction':
      return 44;
    case 'ControlledActuator':
    case 'ActuatingSystem':
      return 52;
    default:
      return 80;
  }
}

function flattenAttributes(obj: any): Record<string, string> {
  const result: Record<string, string> = {};
  if (!obj) return result;

  if (obj.attributes && typeof obj.attributes === 'object') {
    for (const [k, v] of Object.entries(obj.attributes)) {
      if (v !== undefined && v !== null) {
        if (typeof v === 'object' && 'value' in (v as any)) {
          result[k] = String((v as any).value);
        } else {
          result[k] = String(v);
        }
      }
    }
  }

  if (obj.customAttributes && Array.isArray(obj.customAttributes)) {
    for (const ca of obj.customAttributes) {
      if (ca.attributeName && ca.value !== undefined && ca.value !== null) {
        result[ca.attributeName] = String(ca.value);
      }
    }
  }

  return result;
}

function extractRotation(item: any): number | undefined {
  if (item?.attributes?.rotation) {
    const val = parseFloat(item.attributes.rotation);
    if (!isNaN(val)) return val;
  }
  if (item?.position?.reference) {
    const rx = item.position.reference.x ?? 1;
    const ry = item.position.reference.y ?? 0;
    const deg = Math.round((Math.atan2(ry, rx) * 180) / Math.PI);
    return (deg + 360) % 360;
  }
  return undefined;
}

function extractMirrored(item: any): boolean | undefined {
  if (item?.attributes?.mirrored) {
    return item.attributes.mirrored === 'true';
  }
  return undefined;
}

import { resolveIndex } from '../walk';

/** Factor that converts a coordinate in `PlantInformation/@Units` to millimetres. */
export function unitsToMm(units?: string): number {
  switch ((units || 'mm').trim().toLowerCase()) {
    case 'mm':
    case 'millimetre':
    case 'millimeter':
      return 1;
    case 'cm':
    case 'centimetre':
    case 'centimeter':
      return 10;
    case 'm':
    case 'metre':
    case 'meter':
      return 1000;
    case 'in':
    case 'inch':
      return 25.4;
    case 'ft':
    case 'foot':
      return 304.8;
    case 'angstrom':
      // Some vendor exports mislabel millimetre drawings as "Angstrom"; 1e-7 mm
      // would collapse the diagram to a point, so treat it as millimetres.
      return 1;
    default:
      return 1;
  }
}

export function projectToView(model: DexpiModel): PidView {
  const nodes: PidViewNode[] = [];
  const edges: PidViewEdge[] = [];
  const labels: PidViewLabel[] = [];

  // Proteus coordinates are in PlantInformation/@Units. Normalise everything to
  // millimetres so the canvas, SVG export and downstream tooling share one unit.
  const U = unitsToMm(model.units);

  const maxY = (model.diagram?.maxY ?? 900 / U) * U;
  const maxX = (model.diagram?.maxX ?? 1600 / U) * U;
  const minX = (model.diagram?.minX ?? 0) * U;
  const minY = (model.diagram?.minY ?? 0) * U;

  // Scale factor to make small (A3-ish) diagrams comfortable on the maxGraph canvas.
  const scale = maxX - minX <= 500 && maxY - minY <= 500 ? 3 : 1;

  // Inputs are raw file-unit coordinates; output is display pixels.
  // `<Position><Location>` marks the *center* of a component's symbol (verified
  // against real files: e.g. a Tank's Location X="194" Y="198" matches its own
  // reference-rendered `translate(194,-198)`), never a corner — callers that
  // place an anchored w x h box must subtract half its (already display-scale)
  // width/height themselves; centerline/waypoint callers use these bare.
  const flipY = (y: number): number => Math.round((maxY - y * U) * scale);
  const scaleX = (x: number): number => Math.round(x * U * scale);

  // Fallback layout for items with no <Position> at all (common in semantic-only
  // / partial DEXPI files, e.g. the DEXPI instrumentation test cases). Every
  // fallback used to be a fixed point per item type, so 2+ unpositioned items
  // of the same kind rendered exactly on top of each other. Cascade them into
  // a small grid instead so at least nothing is literally invisible.
  let fallbackSlot = 0;
  const nextFallback = (baseXmm: number, baseYmm: number): { x: number; y: number } => {
    const col = fallbackSlot % 6;
    const row = Math.floor(fallbackSlot / 6);
    fallbackSlot++;
    return { x: (baseXmm + col * 70) / U, y: (baseYmm + row * 70) / U };
  };

  const cm = model.conceptualModel;
  if (!cm) {
    return { nodes, edges, labels, bounds: { x: 0, y: 0, w: 1200, h: 800 } };
  }

  // `<ShapeCatalogue>` `Shape`s, keyed by `ComponentName` for O(1) lookup per
  // placed element — mirrors pyDEXPI's `ShapeUsage` resolving a `Shape` by
  // reference out of the document's own catalogue.
  const shapesByComponentName = new Map<string, Shape>();
  for (const catalogue of model.shapeCatalogues || []) {
    for (const shape of catalogue.shapes) {
      if (shape.componentName && !shapesByComponentName.has(shape.componentName)) {
        shapesByComponentName.set(shape.componentName, shape);
      }
    }
  }

  /** Resolves the real geometry available for a placed element: a catalogue `Shape` reference and/or inline primitives. */
  function resolveSymbolGeometry(
    componentName: string | undefined,
    graphics: GraphicPrimitive[] | undefined
  ): {
    symbolShape?: Shape;
    symbolPrimitives?: GraphicPrimitive[];
    catalogNative?: { w: number; h: number };
    inlineNative?: { w: number; h: number };
  } {
    const symbolShape = componentName ? shapesByComponentName.get(componentName) : undefined;
    const symbolPrimitives = graphics && graphics.length > 0 ? graphics : undefined;
    const catalogBounds = symbolShape ? boundsOfPrimitives(symbolShape.primitives) : undefined;
    const inlineBounds = symbolPrimitives ? boundsOfPrimitives(symbolPrimitives) : undefined;
    return {
      symbolShape,
      symbolPrimitives,
      catalogNative: catalogBounds && catalogBounds.w > 0 && catalogBounds.h > 0 ? { w: catalogBounds.w, h: catalogBounds.h } : undefined,
      inlineNative: inlineBounds && inlineBounds.w > 0 && inlineBounds.h > 0 ? { w: inlineBounds.w, h: inlineBounds.h } : undefined,
    };
  }

  const index = resolveIndex(model);
  const idMap = new Map<string, any>();
  for (const [id, entry] of index.entries()) {
    idMap.set(id, entry.obj);
    if (entry.obj.proteusId) {
      idMap.set(entry.obj.proteusId, entry.obj);
    }
  }

  const resolveNodeId = (itemId?: string): string => {
    if (!itemId) return '';
    const obj = idMap.get(itemId);
    return obj?.proteusId || obj?.id || itemId;
  };

  // 1. Equipment & Nozzles
  for (const item of cm.taggedPlantItems) {
    const eq = item as Equipment;
    const dexpiClass = eq.dexpiClass || 'Equipment';

    // `extent?.max.x && extent?.min.x` used to gate on numeric truthiness, which
    // wrongly fell through to the default size whenever a bound was exactly 0
    // (common — extents are frequently expressed relative to the item's own
    // position). Gate on the extent's *presence* instead.
    const extW = eq.extent && eq.extent.max.x - eq.extent.min.x > 0 ? (eq.extent.max.x - eq.extent.min.x) * U : undefined;
    const extH = eq.extent && eq.extent.max.y - eq.extent.min.y > 0 ? (eq.extent.max.y - eq.extent.min.y) * U : undefined;
    const eqGeometry = resolveSymbolGeometry(eq.componentName, eq.graphics);
    const eqSize = resolveScaledSize(
      extW,
      extH,
      eq.scale,
      eqGeometry.catalogNative,
      eqGeometry.inlineNative,
      getNominalEquipmentSize(dexpiClass),
      { w: getDefaultWidth(dexpiClass), h: getDefaultHeight(dexpiClass) },
      U
    );
    const w = eqSize.w * scale;
    const h = eqSize.h * scale;

    const eqFallback = nextFallback(100, 100);
    const rawX = eq.position?.location.x ?? eqFallback.x;
    const rawY = eq.position?.location.y ?? eqFallback.y;

    const x = scaleX(rawX) - w / 2;
    const y = flipY(rawY) - h / 2;

    const eqId = eq.proteusId || eq.id;

    const eqNode: PidViewNode = {
      id: eqId,
      kind: 'equipment',
      dexpiClass,
      componentClassUri: eq.componentClassUri,
      componentName: eq.componentName,
      symbolShape: eqGeometry.symbolShape,
      symbolPrimitives: eqGeometry.symbolPrimitives,
      tagName: eq.tagName || eqId,
      x,
      y,
      w: Math.round(w),
      h: Math.round(h),
      rotation: extractRotation(eq),
      mirrored: extractMirrored(eq),
      attributes: flattenAttributes(eq),
      sourcePath: ['conceptualModel', 'taggedPlantItems', eq.id],
    };
    nodes.push(eqNode);

    // Nozzles
    if (eq.nozzles && Array.isArray(eq.nozzles)) {
      for (let i = 0; i < eq.nozzles.length; i++) {
        const noz = eq.nozzles[i];
        const portSize = 8;
        let relX = 0;
        let relY = 0.5;

        if (noz.position?.location) {
          const nx = scaleX(noz.position.location.x);
          const ny = flipY(noz.position.location.y);
          relX = Math.max(0, Math.min(1, (nx - x) / (w || 1)));
          relY = Math.max(0, Math.min(1, (ny - y) / (h || 1)));
        } else {
          // Fallback distribution
          if (i === 0) {
            relX = 0;
            relY = 0.5;
          } else if (i === 1) {
            relX = 1;
            relY = 0.5;
          } else {
            relX = 0.5;
            relY = 0;
          }
        }

        const nozId = noz.proteusId || noz.id;
        const nozNode: PidViewNode = {
          id: nozId,
          kind: 'nozzle',
          dexpiClass: 'Nozzle',
          tagName: noz.subTagName || `N${i + 1}`,
          x: Math.round(x + relX * w),
          y: Math.round(y + relY * h),
          w: portSize,
          h: portSize,
          parentId: eqId,
          portRel: { x: relX, y: relY },
          attributes: flattenAttributes(noz),
          sourcePath: ['conceptualModel', 'taggedPlantItems', eq.id, 'nozzles', noz.id],
        };
        nodes.push(nozNode);
      }
    }
  }

  // 2. Piping Network Systems, Segments, and Valves
  for (const pns of cm.pipingNetworkSystems) {
    for (const seg of pns.segments) {
      // PipingComponents (valves, etc.)
      for (const comp of seg.items) {
        if (!('dexpiClass' in comp)) continue;
        const pComp = comp as PipingComponent;
        const dexpiClass = pComp.dexpiClass || 'PipingComponent';
        const compExtW = pComp.extent && pComp.extent.max.x - pComp.extent.min.x > 0 ? (pComp.extent.max.x - pComp.extent.min.x) * U : undefined;
        const compExtH = pComp.extent && pComp.extent.max.y - pComp.extent.min.y > 0 ? (pComp.extent.max.y - pComp.extent.min.y) * U : undefined;
        const compGeometry = resolveSymbolGeometry(pComp.componentName, pComp.graphics);
        const compSize = resolveScaledSize(
          compExtW,
          compExtH,
          pComp.scale,
          compGeometry.catalogNative,
          compGeometry.inlineNative,
          { w: NOMINAL_PIPING_SYMBOL_W, h: NOMINAL_PIPING_SYMBOL_H },
          { w: getDefaultWidth(dexpiClass), h: getDefaultHeight(dexpiClass) },
          U
        );
        const cw = compSize.w * scale;
        const ch = compSize.h * scale;

        const pCompFallback = nextFallback(200, 200);
        const rawX = pComp.position?.location.x ?? pCompFallback.x;
        const rawY = pComp.position?.location.y ?? pCompFallback.y;

        const cx = scaleX(rawX) - cw / 2;
        const cy = flipY(rawY) - ch / 2;
        const compId = pComp.proteusId || pComp.id;

        const compNode: PidViewNode = {
          id: compId,
          kind: 'pipingComponent',
          dexpiClass,
          componentClassUri: pComp.componentClassUri,
          componentName: pComp.componentName,
          symbolShape: compGeometry.symbolShape,
          symbolPrimitives: compGeometry.symbolPrimitives,
          // No fallback to the raw element ID here: most piping components
          // legitimately carry no TagName, and `PidViewNode.tagName` being ''
          // is what suppresses the label in the renderer (see exportSvg.ts).
          tagName: pComp.tagName || '',
          x: cx,
          y: cy,
          w: Math.round(cw),
          h: Math.round(ch),
          rotation: extractRotation(pComp),
          mirrored: extractMirrored(pComp),
          attributes: flattenAttributes(pComp),
          sourcePath: ['conceptualModel', 'pipingNetworkSystems', pns.id, 'segments', seg.id, 'items', pComp.id],
        };
        nodes.push(compNode);
      }

      // Segment Connections / Pipes
      const label = [seg.fluidCode, seg.nominalDiameterRepresentation].filter(Boolean).join(' ') || pns.lineNumber || '';
      const segId = seg.proteusId || seg.id;

      // A `<PipingNetworkSegment>` can chain several inline components, each
      // separated by its own `<CenterLine>` leg (e.g. tap -> valve -> tee -> next
      // tap) — `resolveSegmentConnections` (piping.ts) already resolves each leg's
      // own source/target into `seg.connections` (one `Pipe`/`DirectPipingConnection`
      // per leg). The old code drew only the segment's first-seen CenterLine as a
      // single edge, silently discarding every leg after the first inline component
      // and leaving visible gaps wherever a segment had more than one.
      const pipeLegs = seg.connections.filter(
        (c): c is Pipe => !!(c as Pipe).centerLine?.points?.length
      );

      if (pipeLegs.length > 0) {
        pipeLegs.forEach((leg, legIdx) => {
          const waypoints = leg.centerLine!.points.map((pt) => ({ x: scaleX(pt.x), y: flipY(pt.y) }));
          if (waypoints.length < 2) return;
          const edge: PidViewEdge = {
            id: `${segId}-edge-${legIdx}`,
            kind: 'pipe',
            lineKind: 'pipe',
            dexpiClass: 'PipingNetworkSegment',
            sourceId: leg.sourceItem ? resolveNodeId(leg.sourceItem) : '',
            sourceNode: resolveNodeId(leg.sourceNode),
            targetId: leg.targetItem ? resolveNodeId(leg.targetItem) : '',
            targetNode: resolveNodeId(leg.targetNode),
            waypoints,
            label,
            fluidCode: seg.fluidCode,
            attributes: flattenAttributes(seg),
            sourcePath: ['conceptualModel', 'pipingNetworkSystems', pns.id, 'segments', seg.id],
          };
          edges.push(edge);
        });
      } else if (seg.centerLine?.points && seg.centerLine.points.length >= 2) {
        // Fallback for segments with geometry that never made it into `connections`
        // (e.g. no `<Connection>` chain resolved at all) — still draw what we have.
        const waypoints = seg.centerLine.points.map((pt) => ({ x: scaleX(pt.x), y: flipY(pt.y) }));
        const edge: PidViewEdge = {
          id: `${segId}-edge`,
          kind: 'pipe',
          lineKind: 'pipe',
          dexpiClass: 'PipingNetworkSegment',
          sourceId: seg.sourceItem ? resolveNodeId(seg.sourceItem) : '',
          sourceNode: resolveNodeId(seg.sourceNode),
          targetId: seg.targetItem ? resolveNodeId(seg.targetItem) : '',
          targetNode: resolveNodeId(seg.targetNode),
          waypoints,
          label,
          fluidCode: seg.fluidCode,
          attributes: flattenAttributes(seg),
          sourcePath: ['conceptualModel', 'pipingNetworkSystems', pns.id, 'segments', seg.id],
        };
        edges.push(edge);
      }
    }
  }

  // 3. Process Instrumentation Functions & Actuators
  for (const pif of cm.processInstrumentationFunctions) {
    const pifFallback = nextFallback(300, 300);
    const rawX = pif.position?.location.x ?? pifFallback.x;
    const rawY = pif.position?.location.y ?? pifFallback.y;
    const instGeometry = resolveSymbolGeometry(pif.componentName, pif.graphics);
    const instNative = instGeometry.inlineNative ?? instGeometry.catalogNative;
    const instW = (instNative?.w ?? NOMINAL_INSTRUMENT_SYMBOL_SIZE) * U * scale;
    const instH = (instNative?.h ?? NOMINAL_INSTRUMENT_SYMBOL_SIZE) * U * scale;

    const tagName = [pif.processInstrumentationFunctionCategory, pif.processInstrumentationFunctionNumber]
      .filter(Boolean)
      .join(' ') || pif.proteusId || pif.id;

    const instId = pif.proteusId || pif.id;

    const instNode: PidViewNode = {
      id: instId,
      kind: 'instrument',
      dexpiClass: pif.dexpiClass || 'ProcessInstrumentationFunction',
      componentClassUri: pif.componentClassUri,
      componentName: pif.componentName,
      symbolShape: instGeometry.symbolShape,
      symbolPrimitives: instGeometry.symbolPrimitives,
      tagName,
      x: scaleX(rawX) - instW / 2,
      y: flipY(rawY) - instH / 2,
      w: Math.round(instW),
      h: Math.round(instH),
      attributes: flattenAttributes(pif),
      sourcePath: ['conceptualModel', 'processInstrumentationFunctions', pif.id],
    };
    nodes.push(instNode);

    // Signals
    for (const sig of pif.signalConveyingFunctions) {
      if (sig.sourceItem && sig.targetItem) {
        const sigEdge: PidViewEdge = {
          id: sig.proteusId || sig.id,
          kind: 'signal',
          lineKind: 'signal',
          dexpiClass: 'SignalConveyingFunction',
          sourceId: resolveNodeId(sig.sourceItem),
          targetId: resolveNodeId(sig.targetItem),
          waypoints: sig.centerLine?.points
            ? sig.centerLine.points.map((pt) => ({ x: scaleX(pt.x), y: flipY(pt.y) }))
            : [],
          attributes: flattenAttributes(sig),
          sourcePath: ['conceptualModel', 'processInstrumentationFunctions', pif.id, 'signalConveyingFunctions', sig.id],
        };
        edges.push(sigEdge);
      }
    }
  }

  // 4. Actuating Systems
  for (const act of cm.actuatingSystems) {
    // `<ActuatingSystem>` itself rarely carries its own <Position> — the real
    // placement lives on its first `<ActuatingSystemComponent>` child (the
    // controlled actuator), which projectToView used to ignore entirely, so
    // every actuator without an (essentially always absent) system-level
    // position fell back to the same fixed point and stacked on top of each
    // other.
    const actuator = act.controlledActuators?.[0];
    const position = act.position ?? actuator?.position;
    const actFallback = nextFallback(350, 350);
    const rawX = position?.location.x ?? actFallback.x;
    const rawY = position?.location.y ?? actFallback.y;
    const actuatorScale = actuator?.scale;
    const actGeometry = resolveSymbolGeometry(actuator?.componentName, actuator?.graphics);
    const actNative = actGeometry.inlineNative ?? actGeometry.catalogNative;
    const nominalActW = actNative?.w ?? NOMINAL_ACTUATOR_SYMBOL_W;
    const nominalActH = actNative?.h ?? NOMINAL_ACTUATOR_SYMBOL_H;
    const aw = (actuatorScale ? nominalActW * actuatorScale.x : 44) * U * scale;
    const ah = (actuatorScale ? nominalActH * actuatorScale.y : 52) * U * scale;

    const actId = act.proteusId || act.id;

    const actNode: PidViewNode = {
      id: actId,
      kind: 'actuator',
      dexpiClass: 'ActuatingSystem',
      componentName: actuator?.componentName,
      symbolShape: actGeometry.symbolShape,
      symbolPrimitives: actGeometry.symbolPrimitives,
      tagName: act.actuatingSystemNumber || actId,
      x: scaleX(rawX) - aw / 2,
      y: flipY(rawY) - ah / 2,
      w: Math.round(aw),
      h: Math.round(ah),
      attributes: flattenAttributes(act),
      sourcePath: ['conceptualModel', 'actuatingSystems', act.id],
    };
    nodes.push(actNode);
  }

  return {
    nodes,
    edges,
    labels,
    bounds: {
      x: minX * scale,
      y: minY * scale,
      w: (maxX - minX) * scale,
      h: (maxY - minY) * scale,
    },
  };
}

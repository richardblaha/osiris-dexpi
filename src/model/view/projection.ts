/**
 * Visual canvas projection from DexpiModel to PidView.
 * Translates DEXPI domain model into flattened, canvas-ready PidView data structure.
 * Handles Y-flip (DEXPI Y-up millimetres -> canvas Y-down coordinates).
 */

import type { DexpiModel } from '../classes/dexpiModel';
import type { TaggedPlantItem, Equipment, Nozzle } from '../classes/equipment';
import type { PipingComponent } from '../classes/piping';
import type { ProcessInstrumentationFunction, ActuatingSystem } from '../classes/instrumentation';

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
  const flipY = (y: number, hMm: number = 0): number => {
    return Math.round((maxY - y * U - hMm) * scale);
  };
  const scaleX = (x: number): number => Math.round(x * U * scale);

  const cm = model.conceptualModel;
  if (!cm) {
    return { nodes, edges, labels, bounds: { x: 0, y: 0, w: 1200, h: 800 } };
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

    const w = (eq.extent?.max.x && eq.extent?.min.x ? (eq.extent.max.x - eq.extent.min.x) * U : getDefaultWidth(dexpiClass)) * scale;
    const h = (eq.extent?.max.y && eq.extent?.min.y ? (eq.extent.max.y - eq.extent.min.y) * U : getDefaultHeight(dexpiClass)) * scale;

    const rawX = eq.position?.location.x ?? 100 / U;
    const rawY = eq.position?.location.y ?? 100 / U;

    const x = scaleX(rawX);
    const y = flipY(rawY, h / scale);

    const eqId = eq.proteusId || eq.id;

    const eqNode: PidViewNode = {
      id: eqId,
      kind: 'equipment',
      dexpiClass,
      componentClassUri: eq.componentClassUri,
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
        const cw = getDefaultWidth(dexpiClass) * scale;
        const ch = getDefaultHeight(dexpiClass) * scale;

        const rawX = pComp.position?.location.x ?? 200 / U;
        const rawY = pComp.position?.location.y ?? 200 / U;

        const cx = scaleX(rawX);
        const cy = flipY(rawY, ch / scale);
        const compId = pComp.proteusId || pComp.id;

        const compNode: PidViewNode = {
          id: compId,
          kind: 'pipingComponent',
          dexpiClass,
          componentClassUri: pComp.componentClassUri,
          tagName: pComp.tagName || compId,
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

      const waypoints = seg.centerLine?.points
        ? seg.centerLine.points.map((pt) => ({
            x: scaleX(pt.x),
            y: flipY(pt.y),
          }))
        : [];

      if (seg.sourceItem && seg.targetItem) {
        const segId = seg.proteusId || seg.id;
        const edge: PidViewEdge = {
          id: `${segId}-edge`,
          kind: 'pipe',
          lineKind: 'pipe',
          dexpiClass: 'PipingNetworkSegment',
          sourceId: resolveNodeId(seg.sourceItem),
          sourceNode: resolveNodeId(seg.sourceNode),
          targetId: resolveNodeId(seg.targetItem),
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
    const rawX = pif.position?.location.x ?? 300 / U;
    const rawY = pif.position?.location.y ?? 300 / U;
    const size = 44 * scale;

    const tagName = [pif.processInstrumentationFunctionCategory, pif.processInstrumentationFunctionNumber]
      .filter(Boolean)
      .join(' ') || pif.proteusId || pif.id;

    const instId = pif.proteusId || pif.id;

    const instNode: PidViewNode = {
      id: instId,
      kind: 'instrument',
      dexpiClass: pif.dexpiClass || 'ProcessInstrumentationFunction',
      componentClassUri: pif.componentClassUri,
      tagName,
      x: scaleX(rawX),
      y: flipY(rawY, size / scale),
      w: Math.round(size),
      h: Math.round(size),
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
    const rawX = act.position?.location.x ?? 350 / U;
    const rawY = act.position?.location.y ?? 350 / U;
    const aw = 44 * scale;
    const ah = 52 * scale;

    const actId = act.proteusId || act.id;

    const actNode: PidViewNode = {
      id: actId,
      kind: 'actuator',
      dexpiClass: 'ActuatingSystem',
      tagName: act.actuatingSystemNumber || actId,
      x: scaleX(rawX),
      y: flipY(rawY, ah / scale),
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

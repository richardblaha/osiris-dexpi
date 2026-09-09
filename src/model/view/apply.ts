/**
 * Applies visual PidView canvas edits back to the DexpiModel.
 * Inverts coordinate transforms (canvas Y-down -> DEXPI Y-up mm).
 * Handles connectivity derivation (wires new edges, updates positions, removes deletions).
 */

import type { DexpiModel } from '../classes/dexpiModel';
import type { Equipment } from '../classes/equipment';
import type { PipingNetworkSystem, PipingNetworkSegment, Pipe, PipingComponent } from '../classes/piping';
import type { ProcessInstrumentationFunction } from '../classes/instrumentation';
import type { PidView } from './projection';
import { resolveIndex } from '../walk';
import { make } from '../factory';
import { rdlUriForClass } from '../proteus/rdl';

export function applyViewToModel(view: PidView, model: DexpiModel): DexpiModel {
  const maxY = model.diagram?.maxY ?? 900;
  const maxX = model.diagram?.maxX ?? 1600;
  const scale = maxX <= 500 && maxY <= 500 ? 3 : 1;

  const unscaleX = (x: number): number => Math.round(x / scale);
  const unflipY = (y: number, h: number = 0): number => Math.round(maxY - y / scale - h / scale);

  const cm = model.conceptualModel;
  if (!cm) return model;

  const index = resolveIndex(model);
  const idMap = new Map<string, any>();
  for (const [id, entry] of index.entries()) {
    idMap.set(id, entry.obj);
    if (entry.obj.proteusId) {
      idMap.set(entry.obj.proteusId, entry.obj);
    }
  }

  // 1. Process Nodes
  const viewedNodeIds = new Set<string>();

  for (const vNode of view.nodes) {
    viewedNodeIds.add(vNode.id);
    const existing = idMap.get(vNode.id);

    const x_mm = unscaleX(vNode.x);
    const y_mm = unflipY(vNode.y, vNode.h);

    if (existing) {
      if (vNode.tagName && 'tagName' in existing) {
        existing.tagName = vNode.tagName;
      }
      if (vNode.tagName && 'subTagName' in existing) {
        existing.subTagName = vNode.tagName;
      }
      if (existing.position) {
        existing.position.location = { x: x_mm, y: y_mm, z: 0 };
      } else {
        existing.position = { location: { x: x_mm, y: y_mm, z: 0 } };
      }

      if (vNode.rotation !== undefined) {
        const rad = (vNode.rotation * Math.PI) / 180;
        const refX = Math.round(Math.cos(rad) * 1000) / 1000;
        const refY = Math.round(Math.sin(rad) * 1000) / 1000;
        existing.position.reference = { x: refX, y: refY, z: 0 };
        existing.position.axis = { x: 0, y: 0, z: 1 };
        existing.attributes = existing.attributes || {};
        existing.attributes.rotation = String(vNode.rotation);
      }
      if (vNode.mirrored !== undefined) {
        existing.attributes = existing.attributes || {};
        existing.attributes.mirrored = String(vNode.mirrored);
      }

      if ('extent' in existing && existing.extent) {
        const halfW = vNode.w / scale / 2;
        const halfH = vNode.h / scale / 2;
        existing.extent = {
          min: { x: x_mm - halfW, y: y_mm - halfH },
          max: { x: x_mm + halfW, y: y_mm + halfH },
        };
      }
    } else {
      // Create newly added node
      if (vNode.kind === 'equipment') {
        const halfW = vNode.w / scale / 2;
        const halfH = vNode.h / scale / 2;
        const newEq = make<Equipment>(vNode.dexpiClass || 'Equipment', {
          id: vNode.id,
          proteusId: vNode.id,
          dexpiClass: vNode.dexpiClass || 'Equipment',
          componentClassUri: vNode.componentClassUri || rdlUriForClass(vNode.dexpiClass),
          tagName: vNode.tagName || vNode.id,
          position: { location: { x: x_mm, y: y_mm, z: 0 } },
          extent: {
            min: { x: x_mm - halfW, y: y_mm - halfH },
            max: { x: x_mm + halfW, y: y_mm + halfH },
          },
          nozzles: [],
          chambers: [],
        });
        cm.taggedPlantItems.push(newEq);
        idMap.set(newEq.id, newEq);
      } else if (vNode.kind === 'instrument') {
        const parts = vNode.tagName.split('-');
        const newPif = make<ProcessInstrumentationFunction>(
          vNode.dexpiClass || 'ProcessInstrumentationFunction',
          {
            id: vNode.id,
            proteusId: vNode.id,
            dexpiClass: vNode.dexpiClass || 'ProcessInstrumentationFunction',
            componentClassUri: vNode.componentClassUri || rdlUriForClass(vNode.dexpiClass),
            position: { location: { x: x_mm, y: y_mm, z: 0 } },
            processInstrumentationFunctionCategory: parts[0] || 'FT',
            processInstrumentationFunctionNumber: parts[1] || '101',
            processSignalGeneratingFunctions: [],
            signalConveyingFunctions: [],
            actuatingFunctions: [],
            signalConnectors: [],
            actuatingElectricalFunctions: [],
          }
        );
        cm.processInstrumentationFunctions.push(newPif);
        idMap.set(newPif.id, newPif);
      } else if (vNode.kind === 'pipingComponent') {
        const halfW = vNode.w / scale / 2;
        const halfH = vNode.h / scale / 2;
        const newComp = make<PipingComponent>(vNode.dexpiClass || 'GateValve', {
          id: vNode.id,
          proteusId: vNode.id,
          dexpiClass: vNode.dexpiClass || 'GateValve',
          componentClassUri: vNode.componentClassUri || rdlUriForClass(vNode.dexpiClass),
          tagName: vNode.tagName || vNode.id,
          position: { location: { x: x_mm, y: y_mm, z: 0 } },
          extent: {
            min: { x: x_mm - halfW, y: y_mm - halfH },
            max: { x: x_mm + halfW, y: y_mm + halfH },
          },
        });
        if (!defaultPns.segments[0]) {
          defaultPns.segments.push(
            make<PipingNetworkSegment>('PipingNetworkSegment', {
              id: `seg_${Date.now()}`,
              items: [newComp],
              connections: [],
            })
          );
        } else {
          defaultPns.segments[0].items = defaultPns.segments[0].items || [];
          defaultPns.segments[0].items.push(newComp);
        }
        idMap.set(newComp.id, newComp);
      }
    }
  }

  // 2. Process Edges / Connectivity
  let defaultPns = cm.pipingNetworkSystems[0];
  if (!defaultPns) {
    defaultPns = make<PipingNetworkSystem>('PipingNetworkSystem', {
      lineNumber: 'L-101',
      segments: [],
    });
    cm.pipingNetworkSystems.push(defaultPns);
  }

  const existingSegments = new Map<string, { pns: PipingNetworkSystem; seg: PipingNetworkSegment }>();
  for (const pns of cm.pipingNetworkSystems) {
    for (const seg of pns.segments) {
      existingSegments.set(seg.id, { pns, seg });
      existingSegments.set(`${seg.id}-edge`, { pns, seg });
    }
  }

  const viewedEdgeIds = new Set<string>();

  for (const vEdge of view.edges) {
    viewedEdgeIds.add(vEdge.id);
    const existing = existingSegments.get(vEdge.id);

    const waypoints_mm = vEdge.waypoints.map((pt) => ({
      x: unscaleX(pt.x),
      y: unflipY(pt.y),
    }));

    if (existing) {
      const seg = existing.seg;
      seg.sourceItem = vEdge.sourceId;
      seg.sourceNode = vEdge.sourceNode;
      seg.targetItem = vEdge.targetId;
      seg.targetNode = vEdge.targetNode;
      if (waypoints_mm.length > 0) {
        seg.centerLine = { points: waypoints_mm };
      }
    } else {
      const newPipe = make<Pipe>('Pipe', {
        centerLine: waypoints_mm.length > 0 ? { points: waypoints_mm } : undefined,
      });

      const segId = vEdge.id.replace(/-edge$/, '');
      const newSeg = make<PipingNetworkSegment>('PipingNetworkSegment', {
        id: segId,
        proteusId: segId,
        sourceItem: vEdge.sourceId,
        sourceNode: vEdge.sourceNode,
        targetItem: vEdge.targetId,
        targetNode: vEdge.targetNode,
        connections: [newPipe],
        items: [],
        centerLine: waypoints_mm.length > 0 ? { points: waypoints_mm } : undefined,
      });

      defaultPns.segments.push(newSeg);
      existingSegments.set(newSeg.id, { pns: defaultPns, seg: newSeg });
    }
  }

  // 3. Remove deleted edges
  for (const pns of cm.pipingNetworkSystems) {
    pns.segments = pns.segments.filter((seg) => {
      return viewedEdgeIds.has(seg.id) || viewedEdgeIds.has(`${seg.id}-edge`);
    });
  }

  // 4. Remove deleted nodes from conceptual model
  cm.taggedPlantItems = cm.taggedPlantItems.filter((item) => {
    const id = item.proteusId || item.id;
    return viewedNodeIds.has(id) || viewedNodeIds.has(item.id);
  });

  cm.processInstrumentationFunctions = cm.processInstrumentationFunctions.filter((pif) => {
    const id = pif.proteusId || pif.id;
    return viewedNodeIds.has(id) || viewedNodeIds.has(pif.id);
  });

  for (const pns of cm.pipingNetworkSystems) {
    for (const seg of pns.segments) {
      if (seg.items) {
        seg.items = seg.items.filter((comp) => {
          const id = comp.proteusId || comp.id;
          return viewedNodeIds.has(id) || viewedNodeIds.has(comp.id);
        });
      }
    }
  }

  return model;
}


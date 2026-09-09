/**
 * Root PlantModel serializer for Proteus XML.
 */

import { resolveIndex } from '../../walk';
import type { DexpiModel } from '../../classes/dexpiModel';
import type { RawNode } from '../raw';
import { makeRawNode, isRawNode } from '../raw';
import { buildMetaDataNode } from './metaData';
import { buildEquipmentNode } from './equipment';
import type { Equipment } from '../../classes/equipment';
import { buildPipingNetworkSystemNode } from './piping';
import {
  buildActuatingSystemNode,
  buildProcessInstrumentationFunctionNode,
  buildInstrumentationLoopFunctionNode,
} from './instrumentation';
import { buildDrawingNode, buildShapeCatalogueNode } from './graphics';

export function buildPlantInformationNode(model: DexpiModel, existingNode?: RawNode): RawNode {
  if (existingNode) return existingNode;

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = now.toTimeString().slice(0, 8);

  return makeRawNode(
    'PlantInformation',
    {
      Application: 'osiris-dexpi',
      ApplicationVersion: '0.1.0',
      Date: dateStr,
      Discipline: 'PID',
      Is3D: 'no',
      OriginatingSystem: model.originatingSystemName || 'osiris-dexpi',
      OriginatingSystemVendor: model.originatingSystemVendorName || 'richardblaha',
      OriginatingSystemVersion: model.originatingSystemVersion || '0.1.0',
      SchemaVersion: '4.1.1',
      Time: timeStr,
      Units: 'mm',
    },
    [
      makeRawNode('UnitsOfMeasure', {
        Distance: 'mm',
        Pressure: 'bar',
        Temperature: 'C',
        Flow: 'm3/h',
      }),
    ]
  );
}

export function buildPlantModelNode(model: DexpiModel): RawNode {
  const rootAttrs: Record<string, string> = {
    ...(model._proteus ? model._proteus.attrs : {}),
  };
  if (model.proteusId) {
    rootAttrs.ID = model.proteusId;
  }

  // Build ID lookup table
  const index = resolveIndex(model);
  const objectMap = new Map<string, any>();
  for (const [id, entry] of index.entries()) {
    objectMap.set(id, entry.obj);
    if (entry.obj.proteusId) {
      objectMap.set(entry.obj.proteusId, entry.obj);
    }
  }

  const cm = model.conceptualModel;
  const children: RawNode[] = [];

  const emittedEqIds = new Set<string>();
  const emittedPnsIds = new Set<string>();
  const emittedActIds = new Set<string>();
  const emittedPifIds = new Set<string>();
  const emittedIlfIds = new Set<string>();
  const emittedCatIds = new Set<string>();
  let emittedDiagram = false;
  let emittedMetaData = false;

  if (model._proteus && Array.isArray(model._proteus.extra)) {
    for (const child of model._proteus.extra) {
      if (!isRawNode(child)) continue;

      if (child.tag === 'PlantInformation') {
        children.push(buildPlantInformationNode(model, child));
      } else if (child.tag === 'MetaData') {
        if (cm?.metaData) {
          children.push(buildMetaDataNode(cm.metaData));
          emittedMetaData = true;
        } else {
          children.push(child);
        }
      } else if (child.tag === 'Equipment') {
        const childId = child.attrs.ID;
        const matchingEq = cm?.taggedPlantItems?.find(
          (e) => (e.proteusId && e.proteusId === childId) || e.id === childId
        );
        if (matchingEq) {
          children.push(buildEquipmentNode(matchingEq as Equipment));
          emittedEqIds.add(matchingEq.id);
        }
      } else if (child.tag === 'PipingNetworkSystem') {
        const childId = child.attrs.ID;
        const matchingPns = cm?.pipingNetworkSystems?.find(
          (p) => (p.proteusId && p.proteusId === childId) || p.id === childId
        );
        if (matchingPns) {
          children.push(buildPipingNetworkSystemNode(matchingPns, objectMap));
          emittedPnsIds.add(matchingPns.id);
        }
      } else if (child.tag === 'ActuatingSystem') {
        const childId = child.attrs.ID;
        const matchingAct = cm?.actuatingSystems?.find(
          (a) => (a.proteusId && a.proteusId === childId) || a.id === childId
        );
        if (matchingAct) {
          children.push(buildActuatingSystemNode(matchingAct));
          emittedActIds.add(matchingAct.id);
        }
      } else if (child.tag === 'ProcessInstrumentationFunction') {
        const childId = child.attrs.ID;
        const matchingPif = cm?.processInstrumentationFunctions?.find(
          (p) => (p.proteusId && p.proteusId === childId) || p.id === childId
        );
        if (matchingPif) {
          children.push(buildProcessInstrumentationFunctionNode(matchingPif, objectMap));
          emittedPifIds.add(matchingPif.id);
        }
      } else if (child.tag === 'InstrumentationLoopFunction') {
        const childId = child.attrs.ID;
        const matchingIlf = cm?.instrumentationLoopFunctions?.find(
          (l) => (l.proteusId && l.proteusId === childId) || l.id === childId
        );
        if (matchingIlf) {
          children.push(buildInstrumentationLoopFunctionNode(matchingIlf, objectMap));
          emittedIlfIds.add(matchingIlf.id);
        }
      } else if (child.tag === 'Drawing') {
        if (model.diagram) {
          const dNode = buildDrawingNode(model.diagram);
          if (dNode) children.push(dNode);
          emittedDiagram = true;
        } else {
          children.push(child);
        }
      } else if (child.tag === 'ShapeCatalogue') {
        const childId = child.attrs.ID || child.attrs.Name;
        const matchingCat = model.shapeCatalogues?.find(
          (c) => (c.proteusId && c.proteusId === childId) || c.name === childId
        );
        if (matchingCat) {
          children.push(buildShapeCatalogueNode(matchingCat));
          emittedCatIds.add(matchingCat.id);
        } else {
          children.push(child);
        }
      } else {
        children.push(child);
      }
    }
  } else {
    children.push(buildPlantInformationNode(model));
    if (cm?.metaData) {
      children.push(buildMetaDataNode(cm.metaData));
      emittedMetaData = true;
    }
  }

  // Emit any newly added elements not handled in _proteus
  if (cm?.actuatingSystems) {
    for (const act of cm.actuatingSystems) {
      if (!emittedActIds.has(act.id)) {
        children.push(buildActuatingSystemNode(act));
      }
    }
  }

  if (cm?.pipingNetworkSystems) {
    for (const pns of cm.pipingNetworkSystems) {
      if (!emittedPnsIds.has(pns.id)) {
        children.push(buildPipingNetworkSystemNode(pns, objectMap));
      }
    }
  }

  if (cm?.processInstrumentationFunctions) {
    for (const pif of cm.processInstrumentationFunctions) {
      if (!emittedPifIds.has(pif.id)) {
        children.push(buildProcessInstrumentationFunctionNode(pif, objectMap));
      }
    }
  }

  if (cm?.taggedPlantItems) {
    for (const eq of cm.taggedPlantItems) {
      if (!emittedEqIds.has(eq.id)) {
        children.push(buildEquipmentNode(eq as Equipment));
      }
    }
  }

  if (cm?.instrumentationLoopFunctions) {
    for (const ilf of cm.instrumentationLoopFunctions) {
      if (!emittedIlfIds.has(ilf.id)) {
        children.push(buildInstrumentationLoopFunctionNode(ilf, objectMap));
      }
    }
  }

  if (!emittedDiagram && model.diagram) {
    const dNode = buildDrawingNode(model.diagram);
    if (dNode) children.push(dNode);
  }

  if (model.shapeCatalogues) {
    for (const cat of model.shapeCatalogues) {
      if (!emittedCatIds.has(cat.id)) {
        children.push(buildShapeCatalogueNode(cat));
      }
    }
  }

  return makeRawNode('PlantModel', rootAttrs, children);
}

/**
 * Root PlantModel reader for Proteus XML.
 * Coordinates multi-pass deserialization matching pyDEXPI architecture.
 */

import { make } from '../../factory';
import type { DexpiModel } from '../../classes/dexpiModel';
import type { ConceptualModel } from '../../classes/conceptualModel';
import type { RawNode } from '../raw';
import { childNamed, childrenNamed } from '../raw';
import { ParseContext } from '../core';
import { parseMetaData } from './metaData';
import { parseEquipment } from './equipment';
import {
  parsePipingNetworkSystem,
  resolveSegmentConnections,
  PendingSegmentConnection,
} from './piping';
import {
  parseActuatingSystem,
  parseProcessInstrumentationFunction,
  parseInstrumentationLoopFunction,
  resolveInstrumentationReferences,
  PendingInstrumentation,
} from './instrumentation';
import { parseDrawing, parseShapeCatalogue } from './graphics';

export function parsePlantModel(
  rootNode: RawNode,
  ctx: ParseContext
): DexpiModel {
  ctx.push('PlantModel', rootNode.attrs.ID);

  const plantInfoNode = childNamed(rootNode, 'PlantInformation');
  const exportDateTime = plantInfoNode
    ? `${plantInfoNode.attrs.Date || ''} ${plantInfoNode.attrs.Time || ''}`.trim()
    : undefined;
  const originatingSystemName = plantInfoNode?.attrs.OriginatingSystem;
  const originatingSystemVendorName = plantInfoNode?.attrs.OriginatingSystemVendor;
  const originatingSystemVersion = plantInfoNode?.attrs.OriginatingSystemVersion;
  const units = plantInfoNode?.attrs.Units;

  // PASS 1: Compositional Pass
  const metaDataNodes = childrenNamed(rootNode, 'MetaData');
  const metaData = metaDataNodes.length > 0 ? parseMetaData(metaDataNodes[0], ctx) : undefined;

  const eqNodes = childrenNamed(rootNode, 'Equipment');
  const taggedPlantItems = eqNodes.map((en) => parseEquipment(en, ctx));

  const allPendingSegments: PendingSegmentConnection[] = [];
  const pnsNodes = childrenNamed(rootNode, 'PipingNetworkSystem');
  const pipingNetworkSystems = pnsNodes.map((pn) => {
    const { system, pendingSegments } = parsePipingNetworkSystem(pn, ctx);
    allPendingSegments.push(...pendingSegments);
    return system;
  });

  const pendingInstr: PendingInstrumentation = {
    actuatingSystems: [],
    processInstrumentationFunctions: [],
    instrumentationLoopFunctions: [],
  };

  const actNodes = childrenNamed(rootNode, 'ActuatingSystem');
  const actuatingSystems = actNodes.map((an) => {
    const res = parseActuatingSystem(an, ctx);
    pendingInstr.actuatingSystems.push(res);
    return res.system;
  });

  const pifNodes = childrenNamed(rootNode, 'ProcessInstrumentationFunction');
  const processInstrumentationFunctions = pifNodes.map((pfn) => {
    const res = parseProcessInstrumentationFunction(pfn, ctx);
    pendingInstr.processInstrumentationFunctions.push(res);
    return res.func;
  });

  const ilfNodes = childrenNamed(rootNode, 'InstrumentationLoopFunction');
  const instrumentationLoopFunctions = ilfNodes.map((iln) => {
    const res = parseInstrumentationLoopFunction(iln, ctx);
    pendingInstr.instrumentationLoopFunctions.push(res);
    return res.loop;
  });

  const drawingNodes = childrenNamed(rootNode, 'Drawing');
  const diagram = drawingNodes.length > 0 ? parseDrawing(drawingNodes[0], ctx) : undefined;

  const shapeCatNodes = childrenNamed(rootNode, 'ShapeCatalogue');
  const shapeCatalogues = shapeCatNodes.map((scn) => parseShapeCatalogue(scn, ctx));

  // PASS 2: Reference Pass
  resolveSegmentConnections(allPendingSegments, ctx);
  resolveInstrumentationReferences(pendingInstr, ctx);

  // PASS 3: Control Pass
  // Verify that all referenced IDs exist
  for (const pns of pipingNetworkSystems) {
    for (const seg of pns.segments) {
      if (seg.sourceItem && !ctx.objectRegistry.has(seg.sourceItem)) {
        ctx.errorRegistry.register(
          'warning',
          `Segment ${seg.proteusId} sourceItem "${seg.sourceItem}" not found in registry`,
          seg.proteusId,
          'PipingNetworkSegment'
        );
      }
      if (seg.targetItem && !ctx.objectRegistry.has(seg.targetItem)) {
        ctx.errorRegistry.register(
          'warning',
          `Segment ${seg.proteusId} targetItem "${seg.targetItem}" not found in registry`,
          seg.proteusId,
          'PipingNetworkSegment'
        );
      }
    }
  }

  const conceptualModel = make<ConceptualModel>('ConceptualModel', {
    proteusId: `${rootNode.attrs.ID || 'PlantModel-1'}-CM`,
    actuatingSystems,
    instrumentationLoopFunctions,
    metaData,
    pipingNetworkSystems,
    plantStructureItems: [],
    processInstrumentationFunctions,
    processSignalGeneratingSystems: [],
    taggedPlantItems,
  });

  const model = make<DexpiModel>('DexpiModel', {
    proteusId: rootNode.attrs.ID || 'PlantModel-1',
    exportDateTime,
    originatingSystemName,
    originatingSystemVendorName,
    originatingSystemVersion,
    units,
    conceptualModel,
    diagram,
    shapeCatalogues,
    _proteus: {
      attrs: { ...rootNode.attrs },
      extra: [...rootNode.children],
      childOrder: rootNode.children.map((c) => (typeof c === 'string' ? '#text' : c.tag)),
    },
  });

  ctx.objectRegistry.register(conceptualModel);
  ctx.objectRegistry.register(model, rootNode.attrs.ID);
  ctx.pop(rootNode.attrs.ID);

  return model;
}


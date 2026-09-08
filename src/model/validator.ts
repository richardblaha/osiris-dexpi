/**
 * Topological and schema validator for DEXPI Proteus models.
 * Aligns with pyDEXPI toolkits (piping_toolkit, model_toolkit).
 */

import type { DexpiModel } from './classes/dexpiModel';
import type { Equipment } from './classes/equipment';
import type { ValidationReport, ValidationIssue } from '../common/types';
import { resolveIndex } from './walk';

export class DexpiValidator {
  public validate(model: DexpiModel): ValidationReport {
    const issues: ValidationIssue[] = [];
    const allIds = new Set<string>();

    const registerId = (id?: string, elementType: string = 'Element') => {
      if (!id) {
        issues.push({
          severity: 'error',
          code: 'ERR_EMPTY_ID',
          message: `${elementType} has an empty or missing ID`,
          elementType,
        });
        return;
      }
      if (allIds.has(id)) {
        issues.push({
          severity: 'error',
          code: 'ERR_DUPLICATE_ID',
          message: `Duplicate ID detected: "${id}" in ${elementType}`,
          elementId: id,
          elementType,
        });
      } else {
        allIds.add(id);
      }
    };

    // 1. Root checks
    const rootId = model.proteusId || model.id;
    if (!rootId) {
      issues.push({
        severity: 'error',
        code: 'ERR_ROOT_NO_ID',
        message: 'PlantModel root element must have an ID',
        elementType: 'PlantModel',
      });
    }

    const cm = model.conceptualModel;
    if (!cm) {
      return {
        isValid: false,
        issues: [
          {
            severity: 'error',
            code: 'ERR_NO_CONCEPTUAL_MODEL',
            message: 'Model is missing ConceptualModel',
            elementType: 'DexpiModel',
          },
        ],
        summary: {
          equipmentCount: 0,
          pipingSegmentsCount: 0,
          instrumentsCount: 0,
          errorsCount: 1,
          warningsCount: 0,
        },
      };
    }

    // Build index of all objects by ID and proteusId
    const index = resolveIndex(model);
    const objectMap = new Map<string, any>();
    for (const [id, entry] of index.entries()) {
      objectMap.set(id, entry.obj);
      if (entry.obj.proteusId) {
        objectMap.set(entry.obj.proteusId, entry.obj);
      }
    }

    // 2. Tagged Plant Items (Equipment & Nozzles)
    const equipmentMap = new Map<string, Equipment>();
    const nozzleMap = new Map<string, any>();

    for (const item of cm.taggedPlantItems) {
      const eq = item as Equipment;
      const eqId = eq.proteusId || eq.id;
      registerId(eqId, 'Equipment');
      equipmentMap.set(eq.id, eq);
      if (eq.proteusId) equipmentMap.set(eq.proteusId, eq);

      if (!eq.tagName) {
        issues.push({
          severity: 'warning',
          code: 'WARN_NO_TAGNAME',
          message: `Equipment ${eqId} is missing a TagName`,
          elementId: eqId,
          elementType: 'Equipment',
        });
      }

      if (!eq.dexpiClass) {
        issues.push({
          severity: 'error',
          code: 'ERR_NO_CLASS',
          message: `Equipment ${eqId} is missing dexpiClass`,
          elementId: eqId,
          elementType: 'Equipment',
        });
      }

      if (eq.nozzles) {
        for (const noz of eq.nozzles) {
          const nozId = noz.proteusId || noz.id;
          registerId(nozId, 'Nozzle');
          nozzleMap.set(noz.id, noz);
          if (noz.proteusId) nozzleMap.set(noz.proteusId, noz);
        }
      }
    }

    // 3. Piping Network Systems & Segments
    let totalSegments = 0;
    const connectedElementIds = new Set<string>();

    for (const pns of cm.pipingNetworkSystems) {
      registerId(pns.proteusId || pns.id, 'PipingNetworkSystem');

      for (const seg of pns.segments) {
        totalSegments++;
        const segId = seg.proteusId || seg.id;
        registerId(segId, 'PipingNetworkSegment');

        if (!seg.sourceItem && !seg.targetItem && (!seg.connections || seg.connections.length === 0)) {
          issues.push({
            severity: 'warning',
            code: 'WARN_DISCONNECTED_SEGMENT',
            message: `Piping segment ${segId} has no connections and no endpoints`,
            elementId: segId,
            elementType: 'PipingNetworkSegment',
          });
          continue;
        }

        if (seg.sourceItem) {
          const fromExists = objectMap.has(seg.sourceItem);
          if (!fromExists) {
            issues.push({
              severity: 'error',
              code: 'ERR_BROKEN_CONNECTION_FROM',
              message: `Piping segment ${segId} references non-existent source: "${seg.sourceItem}"`,
              elementId: segId,
              elementType: 'PipingNetworkSegment',
            });
          } else {
            connectedElementIds.add(seg.sourceItem);
            const sourceObj = objectMap.get(seg.sourceItem);
            if (sourceObj?.proteusId) connectedElementIds.add(sourceObj.proteusId);
          }
        }

        if (seg.targetItem) {
          const toExists = objectMap.has(seg.targetItem);
          if (!toExists) {
            issues.push({
              severity: 'error',
              code: 'ERR_BROKEN_CONNECTION_TO',
              message: `Piping segment ${segId} references non-existent target: "${seg.targetItem}"`,
              elementId: segId,
              elementType: 'PipingNetworkSegment',
            });
          } else {
            connectedElementIds.add(seg.targetItem);
            const targetObj = objectMap.get(seg.targetItem);
            if (targetObj?.proteusId) connectedElementIds.add(targetObj.proteusId);
          }
        }

        // Inline piping components (valves, etc.)
        if (seg.items) {
          for (const comp of seg.items) {
            const compId = comp.proteusId || comp.id;
            registerId(compId, 'PipingComponent');
            if (!comp.dexpiClass) {
              issues.push({
                severity: 'warning',
                code: 'WARN_NO_VALVE_CLASS',
                message: `Piping component ${compId} is missing dexpiClass`,
                elementId: compId,
                elementType: 'PipingComponent',
              });
            }
          }
        }
      }
    }

    // 4. Instrumentation
    let totalInstruments = 0;
    for (const pif of cm.processInstrumentationFunctions) {
      totalInstruments++;
      const pifId = pif.proteusId || pif.id;
      registerId(pifId, 'ProcessInstrumentationFunction');

      // Sensor location resolution
      for (const psgf of pif.processSignalGeneratingFunctions || []) {
        if (psgf.sensingLocation && !objectMap.has(psgf.sensingLocation)) {
          issues.push({
            severity: 'warning',
            code: 'WARN_ORPHAN_SENSOR_LOCATION',
            message: `Instrument ${pifId} sensor location "${psgf.sensingLocation}" not found`,
            elementId: pifId,
            elementType: 'ProcessInstrumentationFunction',
          });
        }
      }

      // Signal lines
      for (const sig of pif.signalConveyingFunctions || []) {
        const sigId = sig.proteusId || sig.id;
        registerId(sigId, 'SignalConveyingFunction');
        if (sig.sourceItem && !objectMap.has(sig.sourceItem)) {
          issues.push({
            severity: 'warning',
            code: 'WARN_SIGNAL_ORPHAN_FROM',
            message: `Signal line ${sigId} source "${sig.sourceItem}" not found`,
            elementId: sigId,
            elementType: 'SignalConveyingFunction',
          });
        }
        if (sig.targetItem && !objectMap.has(sig.targetItem)) {
          issues.push({
            severity: 'warning',
            code: 'WARN_SIGNAL_ORPHAN_TO',
            message: `Signal line ${sigId} target "${sig.targetItem}" not found`,
            elementId: sigId,
            elementType: 'SignalConveyingFunction',
          });
        }
      }
    }

    for (const act of cm.actuatingSystems) {
      registerId(act.proteusId || act.id, 'ActuatingSystem');
    }

    for (const ilf of cm.instrumentationLoopFunctions) {
      const loopId = ilf.proteusId || ilf.id;
      registerId(loopId, 'InstrumentationLoopFunction');

      if (!ilf.processInstrumentationFunctions || ilf.processInstrumentationFunctions.length === 0) {
        issues.push({
          severity: 'warning',
          code: 'WARN_EMPTY_LOOP',
          message: `Instrumentation loop ${loopId} contains no instruments`,
          elementId: loopId,
          elementType: 'InstrumentationLoopFunction',
        });
      } else {
        for (const memberId of ilf.processInstrumentationFunctions) {
          if (!objectMap.has(memberId)) {
            issues.push({
              severity: 'warning',
              code: 'WARN_LOOP_MEMBER_NOT_FOUND',
              message: `Instrumentation loop ${loopId} member "${memberId}" not found`,
              elementId: loopId,
              elementType: 'InstrumentationLoopFunction',
            });
          }
        }
      }
    }

    // 5. Unconnected Equipment Check
    for (const item of cm.taggedPlantItems) {
      const eq = item as Equipment;
      const eqId = eq.proteusId || eq.id;
      let isConnected = connectedElementIds.has(eq.id) || (eq.proteusId ? connectedElementIds.has(eq.proteusId) : false);

      if (!isConnected && eq.nozzles) {
        for (const noz of eq.nozzles) {
          if (connectedElementIds.has(noz.id) || (noz.proteusId && connectedElementIds.has(noz.proteusId))) {
            isConnected = true;
            break;
          }
        }
      }

      if (!isConnected) {
        issues.push({
          severity: 'info',
          code: 'INFO_UNCONNECTED_EQUIPMENT',
          message: `Equipment ${eq.tagName || eqId} (${eq.dexpiClass}) has no piping connections`,
          elementId: eqId,
          elementType: 'Equipment',
        });
      }
    }

    const errorsCount = issues.filter((i) => i.severity === 'error').length;
    const warningsCount = issues.filter((i) => i.severity === 'warning').length;

    return {
      isValid: errorsCount === 0,
      issues,
      summary: {
        equipmentCount: cm.taggedPlantItems.length,
        pipingSegmentsCount: totalSegments,
        instrumentsCount: totalInstruments,
        errorsCount,
        warningsCount,
      },
    };
  }
}

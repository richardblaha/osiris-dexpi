/**
 * DexpiModelService: Unified model service for querying and mutating DexpiModel.
 * Decoupled from VS Code and filesystem; shared by Extension Host and MCP.
 */

import type { DexpiModel } from './classes/dexpiModel';
import type { Equipment, Nozzle, PipingNode } from './classes/equipment';
import type { PipingNetworkSystem, PipingNetworkSegment, PipingComponent, Pipe } from './classes/piping';
import type { ProcessInstrumentationFunction } from './classes/instrumentation';
import type { CustomAttribute } from './classes/base';
import type { ValidationReport } from '../common/types';
import { ProteusReader } from './proteus/reader';
import { ProteusWriter } from './proteus/writer';
import { DexpiValidator } from './validator';
import { make } from './factory';
import { rdlUriForClass } from './proteus/rdl';
import { resolveIndex } from './walk';

export interface PidStructureResult {
  source: 'vscode_buffer' | 'file';
  documentUri?: string;
  plantModel: {
    id: string;
    name?: string;
    equipmentCount: number;
    pipingSegmentsCount: number;
    instrumentsCount: number;
  };
  equipment: Array<{
    id: string;
    tagName: string;
    componentClass: string;
    position: { x: number; y: number };
    nozzles: Array<{ id: string; tagName: string; connectionType?: string }>;
    attributes: Record<string, string>;
  }>;
  pipingSystems: Array<{
    id: string;
    tagName: string;
    segments: Array<{
      id: string;
      fluidCode?: string;
      diameter?: string;
      connections: Array<{ fromId: string; toId: string }>;
      valves: Array<{ id: string; tagName: string; componentClass: string }>;
    }>;
  }>;
  instrumentation: Array<{
    loopId: string;
    tagName: string;
    instruments: Array<{ id: string; tagName: string; componentClass: string }>;
    signals: Array<{ id: string; type: string; fromId: string; toId: string }>;
  }>;
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

export class DexpiModelService {
  private _model: DexpiModel;
  private validator = new DexpiValidator();

  constructor(model: DexpiModel) {
    this._model = model;
  }

  public static fromXml(xml: string): DexpiModelService {
    const { model } = ProteusReader.read(xml);
    return new DexpiModelService(model);
  }

  public get model(): DexpiModel {
    return this._model;
  }

  public toXml(includeProlog = true): string {
    return ProteusWriter.write(this._model, includeProlog);
  }

  public getStructure(
    source: 'vscode_buffer' | 'file' = 'file',
    documentUri?: string
  ): PidStructureResult {
    const cm = this._model.conceptualModel;
    const index = resolveIndex(this._model);
    const objectMap = new Map<string, any>();
    for (const [id, entry] of index.entries()) {
      objectMap.set(id, entry.obj);
      if (entry.obj.proteusId) {
        objectMap.set(entry.obj.proteusId, entry.obj);
      }
    }

    const resolveProteusId = (itemId?: string): string => {
      if (!itemId) return '';
      const obj = objectMap.get(itemId);
      return obj?.proteusId || obj?.id || itemId;
    };

    const equipmentList = (cm?.taggedPlantItems || []).map((item) => {
      const eq = item as Equipment;
      const id = eq.proteusId || eq.id;
      return {
        id,
        tagName: eq.tagName || id,
        componentClass: eq.dexpiClass || 'Equipment',
        position: {
          x: eq.position?.location.x ?? 0,
          y: eq.position?.location.y ?? 0,
        },
        nozzles: (eq.nozzles || []).map((n) => ({
          id: n.proteusId || n.id,
          tagName: n.subTagName || n.proteusId || n.id,
          connectionType: 'process',
        })),
        attributes: flattenAttributes(eq),
      };
    });

    const pipingSystemsList = (cm?.pipingNetworkSystems || []).map((pns) => {
      const pnsId = pns.proteusId || pns.id;
      return {
        id: pnsId,
        tagName: pns.lineNumber || pnsId,
        segments: (pns.segments || []).map((seg) => {
          const segId = seg.proteusId || seg.id;
          const connections: Array<{ fromId: string; toId: string }> = [];
          if (seg.sourceItem && seg.targetItem) {
            connections.push({
              fromId: resolveProteusId(seg.sourceItem),
              toId: resolveProteusId(seg.targetItem),
            });
          }

          const valves = (seg.items || []).map((item) => {
            const v = item as PipingComponent;
            const vId = v.proteusId || v.id;
            return {
              id: vId,
              tagName: v.tagName || vId,
              componentClass: v.dexpiClass || 'PipingComponent',
            };
          });

          return {
            id: segId,
            fluidCode: seg.fluidCode,
            diameter: seg.nominalDiameterRepresentation,
            connections,
            valves,
          };
        }),
      };
    });

    const instrumentsList: Array<{
      id: string;
      tagName: string;
      componentClass: string;
    }> = (cm?.processInstrumentationFunctions || []).map((pif) => {
      const pifId = pif.proteusId || pif.id;
      const label = [pif.processInstrumentationFunctionCategory, pif.processInstrumentationFunctionNumber]
        .filter(Boolean)
        .join('-');
      return {
        id: pifId,
        tagName: label || pif.tagName || pifId,
        componentClass: pif.dexpiClass || 'ProcessInstrumentationFunction',
      };
    });

    const instrumentationList =
      cm?.instrumentationLoopFunctions && cm.instrumentationLoopFunctions.length > 0
        ? cm.instrumentationLoopFunctions.map((loop) => {
            const loopId = loop.proteusId || loop.id;
            const memberInstruments = (loop.processInstrumentationFunctions || [])
              .map((memId) => {
                const pif = objectMap.get(memId) as ProcessInstrumentationFunction | undefined;
                if (!pif) return null;
                const pifId = pif.proteusId || pif.id;
                const label = [
                  pif.processInstrumentationFunctionCategory,
                  pif.processInstrumentationFunctionNumber,
                ]
                  .filter(Boolean)
                  .join('-');
                return {
                  id: pifId,
                  tagName: label || pif.tagName || pifId,
                  componentClass: pif.dexpiClass || 'ProcessInstrumentationFunction',
                };
              })
              .filter((i): i is NonNullable<typeof i> => i !== null);

            return {
              loopId,
              tagName: loop.loopNumber || loopId,
              instruments: memberInstruments,
              signals: [],
            };
          })
        : [
            {
              loopId: 'LOOP-001',
              tagName: 'MAIN-LOOP',
              instruments: instrumentsList,
              signals: [],
            },
          ];

    const pipingSegmentsCount = (cm?.pipingNetworkSystems || []).reduce(
      (sum, p) => sum + (p.segments?.length || 0),
      0
    );

    return {
      source,
      documentUri,
      plantModel: {
        id: this._model.proteusId || this._model.id || 'PlantModel-1',
        name: this._model.diagram?.name || 'P&ID',
        equipmentCount: equipmentList.length,
        pipingSegmentsCount,
        instrumentsCount: instrumentsList.length,
      },
      equipment: equipmentList,
      pipingSystems: pipingSystemsList,
      instrumentation: instrumentationList,
    };
  }

  public addEquipment(params: {
    id: string;
    tagName: string;
    componentClass: string;
    componentName?: string;
    x: number;
    y: number;
    width?: number;
    height?: number;
    nozzles?: Array<{ id?: string; tagName?: string; connectionType?: string }>;
    attributes?: Record<string, string>;
  }): { success: boolean; equipmentId: string; message: string } {
    const cm = this._model.conceptualModel;
    if (!cm) throw new Error('ConceptualModel not found');

    const duplicate = cm.taggedPlantItems.find(
      (e) => (e.proteusId && e.proteusId === params.id) || e.id === params.id
    );
    if (duplicate) {
      throw new Error(`Equipment with ID "${params.id}" already exists`);
    }

    const w = params.width || 80;
    const h = params.height || 80;

    const customAttributes: CustomAttribute[] = [];
    if (params.attributes) {
      for (const [k, v] of Object.entries(params.attributes)) {
        customAttributes.push({
          attributeName: k,
          value: v,
          format: 'string',
        });
      }
    }

    const rawNozzles = params.nozzles || [
      { id: `${params.id}-N1`, tagName: 'N1', connectionType: 'Inlet' },
      { id: `${params.id}-N2`, tagName: 'N2', connectionType: 'Outlet' },
    ];

    const nozzles: Nozzle[] = rawNozzles.map((noz, idx) => {
      const nozId = noz.id || `${params.id}-N${idx + 1}`;
      const nozNodeId = `PipingNode-${nozId}`;
      const nodeX = idx === 0 ? params.x : params.x + w;
      const nodeY = params.y + Math.round(h / 2);

      const pipingNode = make<PipingNode>('PipingNode', {
        id: nozNodeId,
        proteusId: nozNodeId,
        nodeType: 'process',
        position: { location: { x: nodeX, y: nodeY, z: 0 } },
      });

      return make<Nozzle>('Nozzle', {
        id: nozId,
        proteusId: nozId,
        subTagName: noz.tagName || `N${idx + 1}`,
        position: { location: { x: nodeX, y: nodeY, z: 0 } },
        nodes: [pipingNode],
      });
    });

    const newEq = make<Equipment>(params.componentClass, {
      id: params.id,
      proteusId: params.id,
      dexpiClass: params.componentClass,
      componentClassUri: rdlUriForClass(params.componentClass),
      tagName: params.tagName,
      position: { location: { x: params.x, y: params.y, z: 0 } },
      extent: {
        min: { x: params.x, y: params.y, z: 0 },
        max: { x: params.x + w, y: params.y + h, z: 0 },
      },
      nozzles,
      chambers: [],
      customAttributes,
      attributes: params.attributes || {},
      _proteus: {
        attrs: {
          ID: params.id,
          ComponentClass: params.componentClass,
          ComponentClassURI: rdlUriForClass(params.componentClass) || '',
          ComponentName: params.componentName || `${params.componentClass.toUpperCase()}_SHAPE`,
          TagName: params.tagName,
        },
        extra: [],
      },
    });

    cm.taggedPlantItems.push(newEq);

    return {
      success: true,
      equipmentId: params.id,
      message: `Equipment ${params.tagName} (${params.componentClass}) added at (${params.x}, ${params.y})`,
    };
  }

  public connectPiping(params: {
    fromId: string;
    toId: string;
    segmentId?: string;
    fluidCode?: string;
    nominalDiameter?: string;
    systemTagName?: string;
    valve?: { id: string; tagName: string; componentClass: string };
  }): { success: boolean; segmentId: string; message: string } {
    const cm = this._model.conceptualModel;
    if (!cm) throw new Error('ConceptualModel not found');

    let system = cm.pipingNetworkSystems[0];
    if (!system) {
      system = make<PipingNetworkSystem>('PipingNetworkSystem', {
        id: 'PNS-001',
        proteusId: 'PNS-001',
        lineNumber: params.systemTagName || 'MAIN-PROCESS-LINE',
        segments: [],
      });
      cm.pipingNetworkSystems.push(system);
    }

    const index = resolveIndex(this._model);
    const objectMap = new Map<string, any>();
    for (const [id, entry] of index.entries()) {
      objectMap.set(id, entry.obj);
      if (entry.obj.proteusId) {
        objectMap.set(entry.obj.proteusId, entry.obj);
      }
    }

    const fromObj = objectMap.get(params.fromId);
    const toObj = objectMap.get(params.toId);

    const segmentId = params.segmentId || `SEG-${Date.now().toString().slice(-4)}`;

    const items: PipingComponent[] = [];
    if (params.valve) {
      const valveComp = make<PipingComponent>(params.valve.componentClass, {
        id: params.valve.id,
        proteusId: params.valve.id,
        tagName: params.valve.tagName,
        dexpiClass: params.valve.componentClass,
        componentClassUri: rdlUriForClass(params.valve.componentClass),
        nodes: [
          make<PipingNode>('PipingNode', {
            id: `${params.valve.id}-Node-1`,
            proteusId: `${params.valve.id}-Node-1`,
            nodeType: 'process',
          }),
          make<PipingNode>('PipingNode', {
            id: `${params.valve.id}-Node-2`,
            proteusId: `${params.valve.id}-Node-2`,
            nodeType: 'process',
          }),
        ],
      });
      items.push(valveComp);
    }

    const pipe = make<Pipe>('Pipe');

    const newSeg = make<PipingNetworkSegment>('PipingNetworkSegment', {
      id: segmentId,
      proteusId: segmentId,
      dexpiClass: 'PipingNetworkSegment',
      fluidCode: params.fluidCode || 'PROC',
      nominalDiameterRepresentation: params.nominalDiameter || 'DN50',
      sourceItem: fromObj?.id || params.fromId,
      sourceNode: fromObj?.nodes?.[0]?.id,
      targetItem: toObj?.id || params.toId,
      targetNode: toObj?.nodes?.[0]?.id,
      items,
      connections: [pipe],
    });

    system.segments.push(newSeg);

    return {
      success: true,
      segmentId,
      message: `Connected "${params.fromId}" to "${params.toId}" via segment ${segmentId}`,
    };
  }

  public updateAttributes(params: {
    elementId: string;
    tagName?: string;
    attributes?: Record<string, string>;
  }): { success: boolean; elementId: string; updatedProperties: string[] } {
    const index = resolveIndex(this._model);
    let target: any = undefined;

    for (const [id, entry] of index.entries()) {
      if (id === params.elementId || entry.obj.proteusId === params.elementId) {
        target = entry.obj;
        break;
      }
    }

    if (!target) {
      throw new Error(`Element with ID "${params.elementId}" not found in model`);
    }

    const updatedProperties: string[] = [];

    if (params.tagName) {
      if ('tagName' in target) {
        target.tagName = params.tagName;
      }
      if ('subTagName' in target) {
        target.subTagName = params.tagName;
      }
      updatedProperties.push('tagName');
    }

    if (params.attributes) {
      if (!target.customAttributes) {
        target.customAttributes = [];
      }
      if (!target.attributes) {
        target.attributes = {};
      }

      for (const [k, v] of Object.entries(params.attributes)) {
        target.attributes[k] = v;

        const existingCa = target.customAttributes.find(
          (ca: CustomAttribute) => ca.attributeName === k
        );
        if (existingCa) {
          existingCa.value = v;
        } else {
          target.customAttributes.push({
            attributeName: k,
            value: v,
            format: 'string',
          });
        }
        updatedProperties.push(`attributes.${k}`);
      }
    }

    return {
      success: true,
      elementId: params.elementId,
      updatedProperties,
    };
  }

  public validate(): ValidationReport {
    return this.validator.validate(this._model);
  }
}


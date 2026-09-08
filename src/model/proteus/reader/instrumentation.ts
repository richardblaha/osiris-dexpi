/**
 * Instrumentation, Loops, Signals, and Actuators reader for Proteus XML.
 */

import { make } from '../../factory';
import { rdlUriForClass } from '../rdl';
import type {
  ProcessInstrumentationFunction,
  ProcessSignalGeneratingFunction,
  SignalConveyingFunction,
  ActuatingSystem,
  ActuatingFunction,
  ControlledActuator,
  Positioner,
  InstrumentationLoopFunction,
} from '../../classes/instrumentation';
import type { RawNode } from '../raw';
import { childNamed, childrenNamed } from '../raw';
import { parseGenericAttributeSets } from './genericAttributes';
import { parsePosition } from './geometry';
import { parseAssociations, AssociationEntry } from './association';
import type { ParseContext } from '../core';

export interface PendingInstrumentation {
  actuatingSystems: { system: ActuatingSystem; fulfillsAssocs: AssociationEntry[] }[];
  processInstrumentationFunctions: {
    func: ProcessInstrumentationFunction;
    associations: AssociationEntry[];
  }[];
  instrumentationLoopFunctions: {
    loop: InstrumentationLoopFunction;
    memberAssocs: AssociationEntry[];
  }[];
}

export function parseActuatingSystem(
  node: RawNode,
  ctx: ParseContext
): { system: ActuatingSystem; fulfillsAssocs: AssociationEntry[] } {
  const proteusId = node.attrs.ID || `ActuatingSystem-${Date.now()}`;
  const dexpiClass = node.attrs.ComponentClass || 'ActuatingSystem';

  const position = parsePosition(node);
  const controlledActuators: ControlledActuator[] = [];
  const actuatingFunctions: ActuatingFunction[] = [];

  // Components (ControlledActuator, Positioner)
  const compNodes = childrenNamed(node, 'ActuatingSystemComponent');
  for (const cn of compNodes) {
    const compProteusId = cn.attrs.ID || `ControlledActuator-${Date.now()}`;
    const compClass = cn.attrs.ComponentClass || 'ControlledActuator';
    const compPos = parsePosition(cn);
    const { typedAttributes, customAttributes } = parseGenericAttributeSets(cn, compClass);

    const actuator = make<ControlledActuator>(compClass, {
      proteusId: compProteusId,
      position: compPos,
      customAttributes,
      ...typedAttributes,
      _proteus: {
        attrs: { ...cn.attrs },
        extra: [...cn.children],
        childOrder: cn.children.map((c) => (typeof c === 'string' ? '#text' : c.tag)),
      },
    });
    ctx.objectRegistry.register(actuator, compProteusId);
    controlledActuators.push(actuator);
  }

  const { typedAttributes, customAttributes } = parseGenericAttributeSets(node, dexpiClass);
  const fulfillsAssocs = parseAssociations(node, proteusId).filter((a) => a.type === 'fulfills');

  // If fulfills points to an ActuatingFunction, create placeholder ActuatingFunction
  for (const fa of fulfillsAssocs) {
    const actFunc = make<ActuatingFunction>('ActuatingFunction', {
      proteusId: fa.itemId,
      controlledActuator: controlledActuators[0]?.id,
    });
    ctx.objectRegistry.register(actFunc, fa.itemId);
    actuatingFunctions.push(actFunc);
  }

  const system = make<ActuatingSystem>(dexpiClass, {
    proteusId,
    position,
    actuatingSystemNumber: typedAttributes.actuatingSystemNumber as string,
    controlledActuators,
    actuatingFunctions,
    customAttributes,
    ...typedAttributes,
    _proteus: {
      attrs: { ...node.attrs },
      extra: [...node.children],
      childOrder: node.children.map((c) => (typeof c === 'string' ? '#text' : c.tag)),
    },
  });

  ctx.objectRegistry.register(system, proteusId);
  return { system, fulfillsAssocs };
}

export function parseProcessInstrumentationFunction(
  node: RawNode,
  ctx: ParseContext
): { func: ProcessInstrumentationFunction; associations: AssociationEntry[] } {
  const proteusId = node.attrs.ID || `ProcessInstrumentationFunction-${Date.now()}`;
  const dexpiClass = node.attrs.ComponentClass || 'ProcessInstrumentationFunction';
  const componentClassUri = node.attrs.ComponentClassURI || rdlUriForClass(dexpiClass);

  const position = parsePosition(node);
  const { typedAttributes, customAttributes } = parseGenericAttributeSets(node, dexpiClass);
  const associations = parseAssociations(node, proteusId);

  // Extract function number / category from labels if not in genericAttributes
  let functionNumber = typedAttributes.processInstrumentationFunctionNumber as string;
  let category = typedAttributes.processInstrumentationFunctionCategory as string;

  const labelNode = childNamed(node, 'Label');
  if (labelNode) {
    const textNodes = childrenNamed(labelNode, 'Text');
    if (textNodes.length > 0 && !category) {
      category = textNodes[0].attrs.String;
    }
    if (textNodes.length > 1 && !functionNumber) {
      functionNumber = textNodes[1].attrs.String;
    }
  }

  const processSignalGeneratingFunctions: ProcessSignalGeneratingFunction[] = [];
  const signalConveyingFunctions: SignalConveyingFunction[] = [];
  const actuatingFunctions: ActuatingFunction[] = [];

  // Sensing location from associations
  for (const assoc of associations) {
    if (assoc.type === 'is location of' || assoc.type === 'measures') {
      const psgf = make<ProcessSignalGeneratingFunction>('ProcessSignalGeneratingFunction', {
        proteusId: `${proteusId}-PSGF`,
        sensingLocation: assoc.itemId,
      });
      processSignalGeneratingFunctions.push(psgf);
    }
  }

  const func = make<ProcessInstrumentationFunction>(dexpiClass, {
    proteusId,
    dexpiClass,
    componentClassUri,
    position,
    processInstrumentationFunctionNumber: functionNumber,
    processInstrumentationFunctionCategory: category,
    processSignalGeneratingFunctions,
    signalConveyingFunctions,
    actuatingFunctions,
    signalConnectors: [],
    actuatingElectricalFunctions: [],
    customAttributes,
    ...typedAttributes,
    _proteus: {
      attrs: { ...node.attrs },
      extra: [...node.children],
      childOrder: node.children.map((c) => (typeof c === 'string' ? '#text' : c.tag)),
    },
  });

  ctx.objectRegistry.register(func, proteusId);
  return { func, associations };
}

export function parseInstrumentationLoopFunction(
  node: RawNode,
  ctx: ParseContext
): { loop: InstrumentationLoopFunction; memberAssocs: AssociationEntry[] } {
  const proteusId = node.attrs.ID || `InstrumentationLoopFunction-${Date.now()}`;
  const dexpiClass = node.attrs.ComponentClass || 'InstrumentationLoopFunction';

  const { typedAttributes, customAttributes } = parseGenericAttributeSets(node, dexpiClass);
  const memberAssocs = parseAssociations(node, proteusId).filter((a) => a.type === 'has member');

  const loop = make<InstrumentationLoopFunction>(dexpiClass, {
    proteusId,
    loopNumber: typedAttributes.loopNumber as string,
    processInstrumentationFunctions: [],
    customAttributes,
    ...typedAttributes,
    _proteus: {
      attrs: { ...node.attrs },
      extra: [...node.children],
      childOrder: node.children.map((c) => (typeof c === 'string' ? '#text' : c.tag)),
    },
  });

  ctx.objectRegistry.register(loop, proteusId);
  return { loop, memberAssocs };
}

export function resolveInstrumentationReferences(
  pending: PendingInstrumentation,
  ctx: ParseContext
): void {
  // Resolve loop member references
  for (const { loop, memberAssocs } of pending.instrumentationLoopFunctions) {
    const memberIds: string[] = [];
    for (const ma of memberAssocs) {
      const obj = ctx.objectRegistry.getByProteusId(ma.itemId);
      if (obj) {
        memberIds.push(obj.id);
      }
    }
    loop.processInstrumentationFunctions = memberIds;
  }

  // Resolve sensingLocation on processSignalGeneratingFunctions
  for (const { func } of pending.processInstrumentationFunctions) {
    for (const psgf of func.processSignalGeneratingFunctions) {
      if (psgf.sensingLocation) {
        const targetObj = ctx.objectRegistry.getByProteusId(psgf.sensingLocation);
        if (targetObj) {
          psgf.sensingLocation = targetObj.id;
        }
      }
    }
  }
}


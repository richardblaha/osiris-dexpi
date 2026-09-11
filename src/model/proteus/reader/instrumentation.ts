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
import { parsePosition, parseScale, parseCenterLine } from './geometry';
import { parseAssociations, AssociationEntry } from './association';
import { parseInlinePrimitives } from './graphics';
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
    const compScale = parseScale(cn);
    const { typedAttributes, customAttributes } = parseGenericAttributeSets(cn, compClass);

    const actuator = make<ControlledActuator>(compClass, {
      proteusId: compProteusId,
      position: compPos,
      scale: compScale,
      componentName: cn.attrs.ComponentName,
      graphics: parseInlinePrimitives(cn),
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

  // The `<Label>`'s own `<Text>` strings are the fully-composed ISA-5.1 instrument
  // identification letters as actually drawn on the diagram (e.g. "PICSA") — prefer
  // them over the `ProcessInstrumentationFunctionCategoryAssignmentClass` generic
  // attribute, which only carries the base measured-variable letter (e.g. "P") and
  // would under-display the bubble's real tag.
  let functionNumber = typedAttributes.processInstrumentationFunctionNumber as string;
  let category = typedAttributes.processInstrumentationFunctionCategory as string;

  // Only the *split* two-Text label form ("PICSA" + "4712.02" as separate <Text>
  // elements) adds information beyond the generic attributes — it's how Proteus
  // exports the fully-composed ISA-5.1 instrument letters, whereas the
  // `...CategoryAssignmentClass` generic attribute only carries the bare
  // measured-variable letter (e.g. "P"). A single-Text label, by contrast, is
  // already the fully-composed tag re-serialized as one string by our own writer
  // (`category + '-' + number`) — splitting it back apart isn't reliable, and the
  // generic attributes already hold the correct separate values in that case, so
  // leave them alone rather than re-deriving from the combined text.
  const labelNode = childNamed(node, 'Label');
  if (labelNode) {
    const textNodes = childrenNamed(labelNode, 'Text');
    // Our own writer re-serializes both Text children with the same fully-composed
    // string (see `updateLabelText` in writer/instrumentation.ts) — so a genuine
    // split label (two *different* strings) is the only case worth trusting over
    // the generic attributes; two identical strings are that writer artifact, not
    // real category/number data.
    if (textNodes.length >= 2 && textNodes[0].attrs.String !== textNodes[1].attrs.String) {
      if (textNodes[0].attrs.String) category = textNodes[0].attrs.String;
      if (textNodes[1].attrs.String) functionNumber = textNodes[1].attrs.String;
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

  // Signal wires: Proteus nests the instrument's measuring line (sensing point ->
  // bubble) and its control/actuation signal (bubble -> actuator) as `<InformationFlow
  // ComponentClass="MeasuringLineFunction"|"SignalConveyingFunction">` children of the
  // `<ProcessInstrumentationFunction>` itself, each carrying its own `<Connection
  // FromID ToID>` and `<CenterLine>`. Both render as the thin signal lines connecting
  // instrument bubbles to their process taps and actuators.
  const infoFlowNodes = childrenNamed(node, 'InformationFlow');
  for (const ifn of infoFlowNodes) {
    const ifnId = ifn.attrs.ID || `InformationFlow-${Date.now()}`;
    const connNode = childNamed(ifn, 'Connection');

    const sig = make<SignalConveyingFunction>('SignalConveyingFunction', {
      proteusId: ifnId,
      signalType: ifn.attrs.ComponentClass,
      sourceItem: connNode?.attrs.FromID,
      targetItem: connNode?.attrs.ToID,
      centerLine: parseCenterLine(ifn),
      _proteus: {
        attrs: { ...ifn.attrs },
        extra: [...ifn.children],
        childOrder: ifn.children.map((c) => (typeof c === 'string' ? '#text' : c.tag)),
      },
    });
    ctx.objectRegistry.register(sig, ifnId);
    signalConveyingFunctions.push(sig);
  }

  const func = make<ProcessInstrumentationFunction>(dexpiClass, {
    proteusId,
    dexpiClass,
    componentClassUri,
    position,
    componentName: node.attrs.ComponentName,
    graphics: parseInlinePrimitives(node),
    processSignalGeneratingFunctions,
    signalConveyingFunctions,
    actuatingFunctions,
    signalConnectors: [],
    actuatingElectricalFunctions: [],
    customAttributes,
    ...typedAttributes,
    // Spread after `typedAttributes` so the Label-derived (fully-composed, e.g.
    // "PICSA") category/number win over the generic-attribute-derived (base-letter
    // only, e.g. "P") values it would otherwise overwrite.
    processInstrumentationFunctionNumber: functionNumber,
    processInstrumentationFunctionCategory: category,
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


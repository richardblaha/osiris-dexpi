/**
 * Instrumentation, Loops, Signals, and Actuators serializer for Proteus XML.
 */

import { rdlUriForClass } from '../rdl';
import type {
  ActuatingSystem,
  ControlledActuator,
  ProcessInstrumentationFunction,
  InstrumentationLoopFunction,
} from '../../classes/instrumentation';
import type { RawNode } from '../raw';
import { makeRawNode, isRawNode } from '../raw';
import { buildGenericAttributesNode } from './genericAttributes';
import { buildPositionNode } from './geometry';
import { updateLabelText } from './equipment';

export function buildControlledActuatorNode(actuator: ControlledActuator): RawNode {
  const id = actuator.proteusId || actuator.id;
  const dexpiClass = actuator.dexpiClass || 'ControlledActuator';
  const componentClassUri = actuator.componentClassUri || rdlUriForClass(dexpiClass);

  const attrs: Record<string, string> = {
    ...(actuator._proteus ? actuator._proteus.attrs : {}),
    ID: id,
    ComponentClass: dexpiClass,
  };
  if (componentClassUri) attrs.ComponentClassURI = componentClassUri;

  const children: RawNode[] = [];
  const handledTags = new Set<string>();

  if (actuator._proteus && Array.isArray(actuator._proteus.extra)) {
    for (const child of actuator._proteus.extra) {
      if (!isRawNode(child)) continue;

      if (child.tag === 'Position') {
        const posNode = buildPositionNode(actuator.position, child);
        if (posNode) children.push(posNode);
        handledTags.add('Position');
      } else if (child.tag === 'GenericAttributes') {
        // Handled after
      } else {
        children.push(child);
      }
    }
  }

  if (!handledTags.has('Position') && actuator.position) {
    const posNode = buildPositionNode(actuator.position);
    if (posNode) children.push(posNode);
  }

  const genAttrs = buildGenericAttributesNode(actuator, dexpiClass);
  if (genAttrs) children.push(genAttrs);

  return makeRawNode('ActuatingSystemComponent', attrs, children);
}

export function buildActuatingSystemNode(system: ActuatingSystem): RawNode {
  const id = system.proteusId || system.id;
  const dexpiClass = system.dexpiClass || 'ActuatingSystem';
  const componentClassUri = system.componentClassUri || rdlUriForClass(dexpiClass);

  const attrs: Record<string, string> = {
    ...(system._proteus ? system._proteus.attrs : {}),
    ID: id,
    ComponentClass: dexpiClass,
  };
  if (componentClassUri) attrs.ComponentClassURI = componentClassUri;

  const children: RawNode[] = [];
  const handledTags = new Set<string>();
  const emittedCompIds = new Set<string>();

  if (system._proteus && Array.isArray(system._proteus.extra)) {
    for (const child of system._proteus.extra) {
      if (!isRawNode(child)) continue;

      if (child.tag === 'Position') {
        const posNode = buildPositionNode(system.position, child);
        if (posNode) children.push(posNode);
        handledTags.add('Position');
      } else if (child.tag === 'ActuatingSystemComponent') {
        const childId = child.attrs.ID;
        const matchingAct = system.controlledActuators?.find(
          (a) => (a.proteusId && a.proteusId === childId) || a.id === childId
        );
        if (matchingAct) {
          children.push(buildControlledActuatorNode(matchingAct));
          emittedCompIds.add(matchingAct.id);
        } else {
          children.push(child);
        }
      } else if (child.tag === 'GenericAttributes') {
        // Handled after
      } else {
        children.push(child);
      }
    }
  }

  if (!handledTags.has('Position') && system.position) {
    const posNode = buildPositionNode(system.position);
    if (posNode) children.unshift(posNode);
  }

  if (system.controlledActuators) {
    for (const act of system.controlledActuators) {
      if (!emittedCompIds.has(act.id)) {
        children.push(buildControlledActuatorNode(act));
      }
    }
  }

  const genAttrs = buildGenericAttributesNode(system, dexpiClass);
  if (genAttrs) children.push(genAttrs);

  return makeRawNode('ActuatingSystem', attrs, children);
}

export function buildProcessInstrumentationFunctionNode(
  pif: ProcessInstrumentationFunction,
  objectMap?: Map<string, any>
): RawNode {
  const id = pif.proteusId || pif.id;
  const dexpiClass = pif.dexpiClass || 'ProcessInstrumentationFunction';
  const componentClassUri = pif.componentClassUri || rdlUriForClass(dexpiClass);

  const attrs: Record<string, string> = {
    ...(pif._proteus ? pif._proteus.attrs : {}),
    ID: id,
    ComponentClass: dexpiClass,
  };
  if (componentClassUri) attrs.ComponentClassURI = componentClassUri;
  if (!attrs.ComponentName) {
    attrs.ComponentName = 'INSTRUMENTATION_BUBBLE_SHAPE';
  }

  const labelText = `${pif.processInstrumentationFunctionCategory || ''}${
    pif.processInstrumentationFunctionNumber ? `-${pif.processInstrumentationFunctionNumber}` : ''
  }`;

  const children: RawNode[] = [];
  const handledTags = new Set<string>();

  const resolveProteusId = (itemId?: string): string | undefined => {
    if (!itemId) return undefined;
    const obj = objectMap?.get(itemId);
    return obj?.proteusId || itemId;
  };

  if (pif._proteus && Array.isArray(pif._proteus.extra)) {
    for (const child of pif._proteus.extra) {
      if (!isRawNode(child)) continue;

      if (child.tag === 'Position') {
        const posNode = buildPositionNode(pif.position, child);
        if (posNode) children.push(posNode);
        handledTags.add('Position');
      } else if (child.tag === 'Label') {
        if (labelText) {
          children.push(updateLabelText(child, labelText));
        } else {
          children.push(child);
        }
        handledTags.add('Label');
      } else if (child.tag === 'GenericAttributes') {
        // Handled after
      } else if (child.tag === 'Association') {
        let itemId = child.attrs.ItemID;
        const psgf = pif.processSignalGeneratingFunctions?.[0];
        if (psgf?.sensingLocation) {
          itemId = resolveProteusId(psgf.sensingLocation) || itemId;
        }
        children.push(makeRawNode('Association', { ...child.attrs, ItemID: itemId }));
        handledTags.add('Association');
      } else {
        children.push(child);
      }
    }
  }

  if (!handledTags.has('Position') && pif.position) {
    const posNode = buildPositionNode(pif.position);
    if (posNode) children.unshift(posNode);
  }

  if (!handledTags.has('Label') && labelText) {
    children.push(
      makeRawNode(
        'Label',
        {
          ID: `${id}-Label`,
          ComponentClass: 'ProcessInstrumentationFunctionLabel',
          ComponentClassURI: 'http://sandbox.dexpi.org/rdl/ProcessInstrumentationFunctionLabel',
        },
        [
          makeRawNode(
            'Text',
            {
              String: labelText,
              Font: 'Calibri',
              Height: '3',
              Width: '0',
              Justification: 'CenterCenter',
            },
            [
              makeRawNode('Position', {}, [
                makeRawNode('Location', {
                  X: String(pif.position?.location?.x ?? 0),
                  Y: String(pif.position?.location?.y ?? 0),
                  Z: '0',
                }),
                makeRawNode('Axis', { X: '0', Y: '0', Z: '1' }),
                makeRawNode('Reference', { X: '1', Y: '0', Z: '0' }),
              ]),
            ]
          ),
        ]
      )
    );
  }

  const genAttrs = buildGenericAttributesNode(pif, dexpiClass);
  if (genAttrs) children.push(genAttrs);

  if (!handledTags.has('Association')) {
    const psgf = pif.processSignalGeneratingFunctions?.[0];
    if (psgf?.sensingLocation) {
      const locId = resolveProteusId(psgf.sensingLocation);
      if (locId) {
        children.push(
          makeRawNode('Association', {
            Type: 'is location of',
            ItemID: locId,
          })
        );
      }
    }
  }

  return makeRawNode('ProcessInstrumentationFunction', attrs, children);
}

export function buildInstrumentationLoopFunctionNode(
  ilf: InstrumentationLoopFunction,
  objectMap?: Map<string, any>
): RawNode {
  const id = ilf.proteusId || ilf.id;
  const dexpiClass = ilf.dexpiClass || 'InstrumentationLoopFunction';
  const componentClassUri = ilf.componentClassUri || rdlUriForClass(dexpiClass) || 'http://sandbox.dexpi.org/rdl/InstrumentationLoopFunction';

  const attrs: Record<string, string> = {
    ...(ilf._proteus ? ilf._proteus.attrs : {}),
    ID: id,
    ComponentClass: dexpiClass,
    ComponentClassURI: componentClassUri,
  };

  const children: RawNode[] = [];
  const handledTags = new Set<string>();

  const resolveProteusId = (itemId?: string): string | undefined => {
    if (!itemId) return undefined;
    const obj = objectMap?.get(itemId);
    return obj?.proteusId || itemId;
  };

  if (ilf._proteus && Array.isArray(ilf._proteus.extra)) {
    for (const child of ilf._proteus.extra) {
      if (!isRawNode(child)) continue;

      if (child.tag === 'GenericAttributes') {
        const genAttrs = buildGenericAttributesNode(ilf, dexpiClass);
        if (genAttrs) children.push(genAttrs);
        handledTags.add('GenericAttributes');
      } else if (child.tag === 'Association') {
        // Will be emitted based on current member list
      } else {
        children.push(child);
      }
    }
  }

  if (!handledTags.has('GenericAttributes')) {
    const genAttrs = buildGenericAttributesNode(ilf, dexpiClass);
    if (genAttrs) children.push(genAttrs);
  }

  if (ilf.processInstrumentationFunctions) {
    for (const memberId of ilf.processInstrumentationFunctions) {
      const pId = resolveProteusId(memberId);
      if (pId) {
        children.push(
          makeRawNode('Association', {
            Type: 'has member',
            ItemID: pId,
          })
        );
      }
    }
  }

  return makeRawNode('InstrumentationLoopFunction', attrs, children);
}


/**
 * DEXPI Instrumentation, Loops, Signals, and Actuators.
 */

import type { DexpiObject, CustomAttributeOwner, CustomAttribute, DexpiValue, Ref, RefList } from './base';
import type { Position, Extent, Scale } from './graphics';

export interface SignalOffPageConnector extends DexpiObject, CustomAttributeOwner {
  referenceConnector?: Ref;
  connectedOffPageConnector?: Ref;
}

export interface SignalConveyingFunction extends DexpiObject, CustomAttributeOwner {
  signalType?: string;
  sourceItem?: Ref;
  targetItem?: Ref;
  centerLine?: { points: { x: number; y: number }[] };
}

export interface Transmitter extends DexpiObject, CustomAttributeOwner {
  transmitterType?: string;
}

export interface PrimaryElement extends DexpiObject, CustomAttributeOwner {
  elementClassification?: string;
}

export interface ProcessSignalGeneratingFunction extends DexpiObject, CustomAttributeOwner {
  sensingLocation?: Ref;
  sensor?: Ref;
  transmitter?: Ref;
}

export interface ControlledActuator extends DexpiObject, CustomAttributeOwner {
  dexpiClass?: string;
  componentClassUri?: string;
  failAction?: string;
  deviceTypeName?: string;
  position?: Position;
  scale?: Scale;
  componentName?: string;
}

export interface Positioner extends DexpiObject, CustomAttributeOwner {
  position?: Position;
}

export interface ActuatingFunction extends DexpiObject, CustomAttributeOwner {
  controlledActuator?: Ref;
  positioner?: Ref;
  position?: Position;
}

export interface ActuatingElectricalFunction extends DexpiObject, CustomAttributeOwner {
  position?: Position;
}

export interface ActuatingSystem extends DexpiObject, CustomAttributeOwner {
  dexpiClass?: string;
  componentClassUri?: string;
  actuatingSystemNumber?: string;
  actuatingFunctions: ActuatingFunction[];
  controlledActuators: ControlledActuator[];
  position?: Position;
}

export interface ProcessSignalGeneratingSystem extends DexpiObject, CustomAttributeOwner {
  systemNumber?: string;
}

export interface ProcessInstrumentationFunction extends DexpiObject, CustomAttributeOwner {
  dexpiClass?: string;
  componentClassUri?: string;
  tagName?: string;
  processInstrumentationFunctionNumber?: string;
  processInstrumentationFunctionCategory?: string;
  processInstrumentationFunctions?: string;
  location?: string;
  panelIdentificationCode?: string;
  processSignalGeneratingFunctions: ProcessSignalGeneratingFunction[];
  signalConveyingFunctions: SignalConveyingFunction[];
  actuatingFunctions: ActuatingFunction[];
  signalConnectors: SignalOffPageConnector[];
  actuatingElectricalFunctions: ActuatingElectricalFunction[];
  position?: Position;
  componentName?: string;
}

export interface InstrumentationLoopFunction extends DexpiObject, CustomAttributeOwner {
  dexpiClass?: string;
  componentClassUri?: string;
  loopNumber?: string;
  processInstrumentationFunctions?: RefList;
}

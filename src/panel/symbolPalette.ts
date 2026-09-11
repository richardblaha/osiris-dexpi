/**
 * Insertable-symbol palette metadata. No pre-baked shape/stencil geometry is
 * referenced here — placing one of these creates an element with no drawn
 * geometry until the document itself supplies some (a `<ShapeCatalogue>` entry
 * matching its `ComponentName`, or inline primitives), same as any other
 * element with no available DEXPI graphics (see `renderNodeBody` in
 * `webview/exportSvg.ts`), which draws a neutral placeholder box instead.
 */

import { rdlUriForClass } from '../model/proteus/rdl';

export type SymbolElementType = 'Equipment' | 'PipingComponent' | 'ProcessInstrument';

export type SymbolCategory =
  | 'Pumps & Compressors'
  | 'Vessels & Tanks'
  | 'Heat Exchangers'
  | 'Valves'
  | 'Fittings & Piping'
  | 'Instruments';

export interface SymbolCatalogItem {
  id: string;
  label: string;
  category: SymbolCategory;
  elementType: SymbolElementType;
  componentClass: string;
  dexpiClass: string;
  componentClassUri: string;
  tagPrefix: string;
  defaultWidth: number;
  defaultHeight: number;
}

const EQUIP = (
  id: string,
  label: string,
  category: SymbolCategory,
  componentClass: string,
  tagPrefix: string,
  defaultWidth: number,
  defaultHeight: number
): SymbolCatalogItem => ({
  id,
  label,
  category,
  elementType: 'Equipment',
  componentClass,
  dexpiClass: componentClass,
  componentClassUri: rdlUriForClass(componentClass),
  tagPrefix,
  defaultWidth,
  defaultHeight,
});

const VALVE = (
  id: string,
  label: string,
  componentClass: string,
  tagPrefix = 'V',
  defaultWidth = 44,
  defaultHeight = 30
): SymbolCatalogItem => ({
  id,
  label,
  category: 'Valves',
  elementType: 'PipingComponent',
  componentClass,
  dexpiClass: componentClass,
  componentClassUri: rdlUriForClass(componentClass),
  tagPrefix,
  defaultWidth,
  defaultHeight,
});

const FITTING = (
  id: string,
  label: string,
  componentClass: string,
  tagPrefix = 'PF',
  defaultWidth = 40,
  defaultHeight = 30
): SymbolCatalogItem => ({
  id,
  label,
  category: 'Fittings & Piping',
  elementType: 'PipingComponent',
  componentClass,
  dexpiClass: componentClass,
  componentClassUri: rdlUriForClass(componentClass),
  tagPrefix,
  defaultWidth,
  defaultHeight,
});

const INSTR = (id: string, label: string, componentClass: string, tagPrefix: string): SymbolCatalogItem => ({
  id,
  label,
  category: 'Instruments',
  elementType: 'ProcessInstrument',
  componentClass,
  dexpiClass: componentClass,
  componentClassUri: rdlUriForClass(componentClass),
  tagPrefix,
  defaultWidth: 44,
  defaultHeight: 44,
});

export const SYMBOL_CATALOG: SymbolCatalogItem[] = [
  // ── Pumps & Compressors ──────────────────────────────────────────────
  EQUIP('pump-centrifugal', 'Centrifugal Pump', 'Pumps & Compressors', 'CentrifugalPump', 'P', 56, 56),
  EQUIP('pump-pd', 'Positive Displacement Pump', 'Pumps & Compressors', 'PositiveDisplacementPump', 'P', 56, 56),
  EQUIP('pump-reciprocating', 'Reciprocating Pump', 'Pumps & Compressors', 'PositiveDisplacementPump', 'P', 60, 56),
  EQUIP('compressor-centrifugal', 'Centrifugal Compressor', 'Pumps & Compressors', 'Compressor', 'K', 80, 64),
  EQUIP('compressor-reciprocating', 'Reciprocating Compressor', 'Pumps & Compressors', 'Compressor', 'K', 84, 60),

  // ── Vessels & Tanks ──────────────────────────────────────────────────
  EQUIP('vessel-vertical', 'Vertical Vessel', 'Vessels & Tanks', 'VerticalVessel', 'V', 80, 160),
  EQUIP('vessel-horizontal', 'Horizontal Vessel', 'Vessels & Tanks', 'HorizontalVessel', 'V', 170, 80),
  EQUIP('tank-storage', 'Storage Tank', 'Vessels & Tanks', 'StorageTank', 'T', 120, 130),
  EQUIP('vessel-column', 'Column / Tower', 'Vessels & Tanks', 'DistillationColumn', 'C', 80, 240),
  EQUIP('vessel-drum', 'Drum', 'Vessels & Tanks', 'HorizontalVessel', 'D', 90, 120),
  EQUIP('vessel-reactor', 'Reactor', 'Vessels & Tanks', 'StirredReactor', 'R', 100, 150),
  EQUIP('vessel-filter', 'Filter', 'Vessels & Tanks', 'Filter', 'F', 90, 140),

  // ── Heat Exchangers ─────────────────────────────────────────────────
  EQUIP('hex-shell-tube', 'Shell & Tube Exchanger', 'Heat Exchangers', 'ShellAndTubeHeatExchanger', 'E', 150, 70),
  EQUIP('hex-plate', 'Plate & Frame Exchanger', 'Heat Exchangers', 'PlateHeatExchanger', 'E', 90, 110),
  EQUIP('hex-air-cooler', 'Air Cooler', 'Heat Exchangers', 'AirCooler', 'E', 150, 90),

  // ── Valves ──────────────────────────────────────────────────────────
  VALVE('valve-gate', 'Gate Valve', 'GateValve', 'HV'),
  VALVE('valve-globe', 'Globe Valve', 'GlobeValve', 'HV'),
  VALVE('valve-ball', 'Ball Valve', 'BallValve', 'HV'),
  VALVE('valve-butterfly', 'Butterfly Valve', 'ButterflyValve', 'HV'),
  VALVE('valve-check', 'Check Valve', 'CheckValve', 'NRV', 48, 30),
  VALVE('valve-needle', 'Needle Valve', 'NeedleValve', 'HV'),
  VALVE('valve-plug', 'Plug Valve', 'PlugValve', 'HV'),
  VALVE('valve-diaphragm', 'Diaphragm Valve', 'DiaphragmValve', 'HV'),
  VALVE('valve-3way', '3-Way Valve', 'ThreeWayValve', 'HV', 44, 44),
  VALVE('valve-control', 'Control Valve (pneumatic)', 'ControlValve', 'FV', 44, 52),
  VALVE('valve-motor', 'Motor Operated Valve', 'ControlValve', 'MOV', 44, 56),
  VALVE('valve-solenoid', 'Solenoid Valve', 'ControlValve', 'SV', 44, 56),
  VALVE('valve-relief', 'Relief Valve', 'SafetyReliefValve', 'PSV', 40, 52),
  VALVE('valve-safety', 'Safety Valve', 'SafetyReliefValve', 'PSV', 44, 60),

  // ── Fittings & Piping ───────────────────────────────────────────────
  FITTING('fit-reducer', 'Reducer', 'Reducer', 'PF', 44, 26),
  FITTING('fit-flange', 'Flanged Connection', 'PipingFlange', 'PF', 24, 30),
  FITTING('fit-cap', 'Pipe Cap', 'PipeCap', 'PF', 24, 30),
  FITTING('fit-blind-flange', 'Blind Flange', 'BlindFlange', 'PF', 22, 30),
  FITTING('fit-strainer', 'Strainer', 'Strainer', 'ST', 40, 30),
  FITTING('fit-flame-arrestor', 'Flame Arrestor', 'FlameArrestor', 'FA', 40, 30),
  FITTING('fit-rupture-disc', 'Rupture Disc', 'RuptureDisc', 'RD', 30, 34),
  FITTING('fit-sight-glass', 'Sight Glass', 'SightGlass', 'SG', 36, 30),
  FITTING('flow-orifice', 'Orifice Plate', 'OrificePlate', 'FE', 34, 34),
  FITTING('flow-venturi', 'Venturi Tube', 'VenturiTube', 'FE', 50, 30),
  FITTING('flow-coriolis', 'Coriolis Meter', 'CoriolisFlowMeter', 'FE', 44, 40),
  FITTING('flow-magnetic', 'Magnetic Flow Meter', 'MagneticFlowMeter', 'FE', 44, 40),
  FITTING('flow-turbine', 'Turbine Meter', 'TurbineFlowMeter', 'FE', 42, 40),

  // ── Instruments (ISA-5.1) ──────────────────────────────────────────
  INSTR('inst-ft', 'Flow Transmitter', 'FlowTransmitter', 'FT'),
  INSTR('inst-pt', 'Pressure Transmitter', 'PressureTransmitter', 'PT'),
  INSTR('inst-tt', 'Temperature Transmitter', 'TemperatureTransmitter', 'TT'),
  INSTR('inst-lt', 'Level Transmitter', 'LevelTransmitter', 'LT'),
  INSTR('inst-at', 'Analyzer Transmitter', 'Sensor', 'AT'),
  INSTR('inst-fi', 'Flow Indicator (field)', 'FlowIndicator', 'FI'),
  INSTR('inst-pi', 'Pressure Indicator (field)', 'PressureIndicator', 'PI'),
  INSTR('inst-ti', 'Temperature Indicator (field)', 'TemperatureIndicator', 'TI'),
  INSTR('inst-li', 'Level Indicator (field)', 'LevelIndicator', 'LI'),
  INSTR('inst-fic', 'Flow Controller (DCS)', 'FlowController', 'FIC'),
  INSTR('inst-pic', 'Pressure Controller (DCS)', 'PressureController', 'PIC'),
  INSTR('inst-tic', 'Temperature Controller (DCS)', 'TemperatureController', 'TIC'),
  INSTR('inst-lic', 'Level Controller (DCS)', 'LevelController', 'LIC'),
];

const BY_ID = new Map(SYMBOL_CATALOG.map((item) => [item.id, item]));

export function catalogItemById(id: string): SymbolCatalogItem | undefined {
  return BY_ID.get(id);
}

export const CATALOG_CATEGORY_ORDER: SymbolCategory[] = [
  'Pumps & Compressors',
  'Vessels & Tanks',
  'Heat Exchangers',
  'Valves',
  'Fittings & Piping',
  'Instruments',
];

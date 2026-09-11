/**
 * Curated P&ID symbol catalog. Each entry maps a user-facing symbol to
 *  - a registered stencil id (see {@link registerPidStencils}, same drawing on canvas & palette),
 *  - the DEXPI element kind + component class written into the model on insert,
 *  - a tag prefix and default size.
 */

import { rdlUriForClass } from '../../model/proteus/rdl';

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
  stencil: string;
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
  stencil: string,
  componentClass: string,
  tagPrefix: string,
  defaultWidth: number,
  defaultHeight: number
): SymbolCatalogItem => ({
  id,
  label,
  category,
  stencil,
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
  stencil: string,
  componentClass: string,
  tagPrefix = 'V',
  defaultWidth = 44,
  defaultHeight = 30
): SymbolCatalogItem => ({
  id,
  label,
  category: 'Valves',
  stencil,
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
  stencil: string,
  componentClass: string,
  tagPrefix = 'PF',
  defaultWidth = 40,
  defaultHeight = 30
): SymbolCatalogItem => ({
  id,
  label,
  category: 'Fittings & Piping',
  stencil,
  elementType: 'PipingComponent',
  componentClass,
  dexpiClass: componentClass,
  componentClassUri: rdlUriForClass(componentClass),
  tagPrefix,
  defaultWidth,
  defaultHeight,
});

const INSTR = (
  id: string,
  label: string,
  stencil: string,
  componentClass: string,
  tagPrefix: string
): SymbolCatalogItem => ({
  id,
  label,
  category: 'Instruments',
  stencil,
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
  EQUIP('pump-centrifugal', 'Centrifugal Pump', 'Pumps & Compressors', 'pid.pumps_iso.pump_centrifugal', 'CentrifugalPump', 'P', 56, 56),
  EQUIP('pump-centrifugal-alt', 'Centrifugal Pump (volute)', 'Pumps & Compressors', 'pid.pumps.centrifugal_pump_1', 'CentrifugalPump', 'P', 60, 60),
  EQUIP('pump-pd', 'Positive Displacement Pump', 'Pumps & Compressors', 'pid.pumps_iso.pump_positive_displacement', 'PositiveDisplacementPump', 'P', 56, 56),
  EQUIP('pump-reciprocating', 'Reciprocating Pump', 'Pumps & Compressors', 'pid.pumps_iso.pump_reciprocating_piston', 'PositiveDisplacementPump', 'P', 60, 56),
  EQUIP('pump-gear', 'Gear Pump', 'Pumps & Compressors', 'pid.pumps_iso.pump_gear', 'PositiveDisplacementPump', 'P', 56, 56),
  EQUIP('pump-diaphragm', 'Diaphragm Pump', 'Pumps & Compressors', 'pid.pumps_iso.pump_diaphragm', 'PositiveDisplacementPump', 'P', 56, 56),
  EQUIP('pump-screw', 'Screw Pump', 'Pumps & Compressors', 'pid.pumps_iso.pump_screw', 'PositiveDisplacementPump', 'P', 60, 56),
  EQUIP('pump-progressive-cavity', 'Progressive Cavity Pump', 'Pumps & Compressors', 'pid.pumps_iso.pump_progressive_cavity', 'PositiveDisplacementPump', 'P', 64, 52),
  EQUIP('pump-vacuum', 'Vacuum Pump', 'Pumps & Compressors', 'pid.pumps.vacuum_pump', 'PositiveDisplacementPump', 'P', 64, 56),
  EQUIP('pump-sump', 'Sump Pump', 'Pumps & Compressors', 'pid.pumps.sump_pump', 'CentrifugalPump', 'P', 56, 72),
  EQUIP('pump-submersible', 'Submersible Pump', 'Pumps & Compressors', 'pid.pumps.submersible_pump', 'CentrifugalPump', 'P', 52, 80),
  EQUIP('compressor-centrifugal', 'Centrifugal Compressor', 'Pumps & Compressors', 'pid.compressors.centrifugal_compressor', 'Compressor', 'K', 80, 64),
  EQUIP('compressor-reciprocating', 'Reciprocating Compressor', 'Pumps & Compressors', 'pid.compressors.reciprocating_compressor', 'Compressor', 'K', 84, 60),
  EQUIP('compressor-rotary', 'Rotary Compressor', 'Pumps & Compressors', 'pid.compressors.rotary_compressor', 'Compressor', 'K', 72, 64),

  // ── Vessels & Tanks ──────────────────────────────────────────────────
  EQUIP('vessel-vertical', 'Vertical Vessel', 'Vessels & Tanks', 'pid.vessels.pressurized_vessel', 'VerticalVessel', 'V', 80, 160),
  EQUIP('vessel-horizontal', 'Horizontal Vessel', 'Vessels & Tanks', 'pid.vessels.vessel_dished_ends_brackets', 'HorizontalVessel', 'V', 170, 80),
  EQUIP('vessel-knockout-drum', 'Knock-out Drum', 'Vessels & Tanks', 'pid.vessels.knock_out_drum', 'HorizontalVessel', 'V', 160, 80),
  EQUIP('tank-storage', 'Storage Tank', 'Vessels & Tanks', 'pid.vessels.tank_conical_roof', 'StorageTank', 'T', 120, 130),
  EQUIP('tank-floating-roof', 'Floating Roof Tank', 'Vessels & Tanks', 'pid.vessels.tank_floating_roof', 'StorageTank', 'T', 120, 120),
  EQUIP('tank-open', 'Open Tank', 'Vessels & Tanks', 'pid.vessels.tank', 'StorageTank', 'T', 110, 120),
  EQUIP('tank-sphere', 'Spherical Tank', 'Vessels & Tanks', 'pid.vessels.storage_sphere', 'StorageTank', 'T', 120, 130),
  EQUIP('vessel-column', 'Column / Tower', 'Vessels & Tanks', 'pid.vessels.tower', 'DistillationColumn', 'C', 80, 240),
  EQUIP('vessel-column-packed', 'Packed Column', 'Vessels & Tanks', 'pid.vessels.tower_with_packing', 'DistillationColumn', 'C', 80, 240),
  EQUIP('vessel-drum', 'Drum', 'Vessels & Tanks', 'pid.vessels.barrel_drum', 'HorizontalVessel', 'D', 90, 120),
  EQUIP('vessel-reactor', 'Reactor', 'Vessels & Tanks', 'pid.vessels.reactor', 'StirredReactor', 'R', 100, 150),
  EQUIP('vessel-mixing-reactor', 'Stirred Reactor', 'Vessels & Tanks', 'pid.vessels.mixing_reactor', 'StirredReactor', 'R', 110, 150),
  EQUIP('vessel-bag-filter', 'Bag Filter', 'Vessels & Tanks', 'pid.vessels.bag', 'Filter', 'F', 90, 140),

  // ── Heat Exchangers ─────────────────────────────────────────────────
  EQUIP('hex-shell-tube', 'Shell & Tube Exchanger', 'Heat Exchangers', 'pid.heat_exchangers.heat_exchanger_straight_tubes', 'ShellAndTubeHeatExchanger', 'E', 150, 70),
  EQUIP('hex-shell-tube-2', 'Shell & Tube (TEMA)', 'Heat Exchangers', 'pid.heat_exchangers.shell_and_tube_heat_exchanger_1', 'ShellAndTubeHeatExchanger', 'E', 160, 80),
  EQUIP('hex-u-tube', 'U-Tube Exchanger', 'Heat Exchangers', 'pid.heat_exchangers.u_tube_heat_exchanger', 'ShellAndTubeHeatExchanger', 'E', 150, 80),
  EQUIP('hex-plate', 'Plate & Frame Exchanger', 'Heat Exchangers', 'pid.heat_exchangers.plate_and_frame_heat_exchanger', 'PlateHeatExchanger', 'E', 90, 110),
  EQUIP('hex-plate-simple', 'Plate Exchanger', 'Heat Exchangers', 'pid.heat_exchangers.heat_exchanger_plate', 'PlateHeatExchanger', 'E', 70, 100),
  EQUIP('hex-air-cooler', 'Air Cooler', 'Heat Exchangers', 'pid.heat_exchangers.heat_exchanger_finned_tubes_fan', 'AirCooler', 'E', 150, 90),
  EQUIP('hex-condenser', 'Condenser', 'Heat Exchangers', 'pid.heat_exchangers.condenser', 'ShellAndTubeHeatExchanger', 'E', 150, 80),
  EQUIP('hex-reboiler', 'Reboiler', 'Heat Exchangers', 'pid.heat_exchangers.reboiler', 'ShellAndTubeHeatExchanger', 'E', 150, 90),
  EQUIP('hex-electric-heater', 'Electric Heater', 'Heat Exchangers', 'pid.heat_exchangers.electric_heater', 'ShellAndTubeHeatExchanger', 'E', 110, 70),

  // ── Valves ──────────────────────────────────────────────────────────
  VALVE('valve-gate', 'Gate Valve', 'pid.valves.gate_valve', 'GateValve', 'HV'),
  VALVE('valve-globe', 'Globe Valve', 'pid.valves.globe_valve', 'GlobeValve', 'HV'),
  VALVE('valve-ball', 'Ball Valve', 'pid.valves.ball_valve', 'BallValve', 'HV'),
  VALVE('valve-butterfly', 'Butterfly Valve', 'pid.valves.butterfly_valve_1', 'ButterflyValve', 'HV'),
  VALVE('valve-check', 'Check Valve', 'pid.valves.check_valve_1', 'CheckValve', 'NRV', 48, 30),
  VALVE('valve-needle', 'Needle Valve', 'pid.valves.needle', 'NeedleValve', 'HV'),
  VALVE('valve-plug', 'Plug Valve', 'pid.valves.plug', 'PlugValve', 'HV'),
  VALVE('valve-diaphragm', 'Diaphragm Valve', 'pid.valves.diaphragm', 'DiaphragmValve', 'HV'),
  VALVE('valve-angle', 'Angle Valve', 'pid.valves.angle', 'AngleValve', 'HV', 40, 40),
  VALVE('valve-3way', '3-Way Valve', 'pid.valves.three_way_valve', 'ThreeWayValve', 'HV', 44, 44),
  VALVE('valve-4way', '4-Way Valve', 'pid.valves.four_way_valve', 'ThreeWayValve', 'HV', 48, 48),
  VALVE('valve-control', 'Control Valve (pneumatic)', 'pid.valves.pneumatic_operated', 'ControlValve', 'FV', 44, 52),
  VALVE('valve-motor', 'Motor Operated Valve', 'pid.valves.motor_operated_valve', 'ControlValve', 'MOV', 44, 56),
  VALVE('valve-solenoid', 'Solenoid Valve', 'pid.valves.solenoid_valve_closed', 'ControlValve', 'SV', 44, 56),
  VALVE('valve-relief', 'Relief Valve', 'pid.valves.relief_prv', 'SafetyReliefValve', 'PSV', 40, 52),
  VALVE('valve-safety', 'Safety Valve', 'pid.valves.safety_psv_1', 'SafetyReliefValve', 'PSV', 44, 60),
  VALVE('valve-prv', 'Pressure Reducing Valve', 'pid.valves.pressure_reducing_valve', 'ControlValve', 'PCV', 44, 44),

  // ── Fittings & Piping ───────────────────────────────────────────────
  FITTING('fit-reducer', 'Reducer (concentric)', 'pid.piping.concentric_reducer', 'Reducer', 'PF', 44, 26),
  FITTING('fit-reducer-ecc', 'Reducer (eccentric)', 'pid.piping.eccentric_reducer', 'Reducer', 'PF', 44, 26),
  FITTING('fit-flange', 'Flanged Connection', 'pid.fittings.flanged_connection', 'PipingFlange', 'PF', 24, 30),
  FITTING('fit-flange-single', 'Flange', 'pid.piping.flange', 'PipingFlange', 'PF', 18, 30),
  FITTING('fit-cap', 'Pipe Cap', 'pid.piping.cap', 'PipeCap', 'PF', 24, 30),
  FITTING('fit-blind', 'Spectacle Blind', 'pid.piping.closed_figure_8_blind', 'SpectacleBlind', 'PF', 26, 34),
  FITTING('fit-blind-flange', 'Blind Flange', 'pid.fittings.blind_disc', 'BlindFlange', 'PF', 22, 30),
  FITTING('fit-strainer', 'Strainer', 'pid.fittings.strainer', 'Strainer', 'ST', 40, 30),
  FITTING('fit-strainer-y', 'Y-Type Strainer', 'pid.piping.y_type_strainer', 'Strainer', 'ST', 40, 34),
  FITTING('fit-steam-trap', 'Steam Trap', 'pid.piping.steam_trap', 'SteamTrap', 'STR', 34, 34),
  FITTING('fit-flame-arrestor', 'Flame Arrestor', 'pid.fittings.flame_arrestor', 'FlameArrestor', 'FA', 40, 30),
  FITTING('fit-silencer', 'Silencer', 'pid.fittings.silencer', 'Silencer', 'SIL', 36, 44),
  FITTING('fit-rupture-disc', 'Rupture Disc', 'pid.fittings.rupture_disc', 'RuptureDisc', 'RD', 30, 34),
  FITTING('fit-sight-glass', 'Sight Glass', 'pid.fittings.viewing_glass', 'SightGlass', 'SG', 36, 30),
  FITTING('fit-inline-mixer', 'In-Line Mixer', 'pid.piping.in_line_mixer', 'StaticMixer', 'MX', 48, 26),
  FITTING('fit-expansion-joint', 'Expansion Joint', 'pid.piping.expansion_joint', 'ExpansionJoint', 'PF', 40, 30),
  FITTING('fit-exhaust-head', 'Exhaust Head', 'pid.piping.exhaust_head', 'ExhaustHead', 'PF', 40, 44),
  FITTING('flow-orifice', 'Orifice Plate', 'pid.fittings.orifice_plate', 'OrificePlate', 'FE', 34, 34),
  FITTING('flow-venturi', 'Venturi Tube', 'pid.flow_sensors.venturi', 'VenturiTube', 'FE', 50, 30),
  FITTING('flow-nozzle', 'Flow Nozzle', 'pid.flow_sensors.flow_nozzle', 'FlowNozzle', 'FE', 40, 30),
  FITTING('flow-vortex', 'Vortex Meter', 'pid.flow_sensors.vortex', 'VortexFlowMeter', 'FE', 40, 40),
  FITTING('flow-coriolis', 'Coriolis Meter', 'pid.flow_sensors.coriolis', 'CoriolisFlowMeter', 'FE', 44, 40),
  FITTING('flow-magnetic', 'Magnetic Flow Meter', 'pid.flow_sensors.magnetic', 'MagneticFlowMeter', 'FE', 44, 40),
  FITTING('flow-turbine', 'Turbine Meter', 'pid.flow_sensors.turbine', 'TurbineFlowMeter', 'FE', 42, 40),

  // ── Instruments (ISA-5.1) ──────────────────────────────────────────
  INSTR('inst-ft', 'Flow Transmitter', 'pid.instruments.discrete', 'FlowTransmitter', 'FT'),
  INSTR('inst-pt', 'Pressure Transmitter', 'pid.instruments.discrete', 'PressureTransmitter', 'PT'),
  INSTR('inst-tt', 'Temperature Transmitter', 'pid.instruments.discrete', 'TemperatureTransmitter', 'TT'),
  INSTR('inst-lt', 'Level Transmitter', 'pid.instruments.discrete', 'LevelTransmitter', 'LT'),
  INSTR('inst-at', 'Analyzer Transmitter', 'pid.instruments.discrete', 'Sensor', 'AT'),
  INSTR('inst-fi', 'Flow Indicator (field)', 'pid.instruments.discrete_field', 'FlowIndicator', 'FI'),
  INSTR('inst-pi', 'Pressure Indicator (field)', 'pid.instruments.discrete_field', 'PressureIndicator', 'PI'),
  INSTR('inst-ti', 'Temperature Indicator (field)', 'pid.instruments.discrete_field', 'TemperatureIndicator', 'TI'),
  INSTR('inst-li', 'Level Indicator (field)', 'pid.instruments.discrete_field', 'LevelIndicator', 'LI'),
  INSTR('inst-fic', 'Flow Controller (DCS)', 'pid.instruments.shared_display', 'FlowController', 'FIC'),
  INSTR('inst-pic', 'Pressure Controller (DCS)', 'pid.instruments.shared_display', 'PressureController', 'PIC'),
  INSTR('inst-tic', 'Temperature Controller (DCS)', 'pid.instruments.shared_display', 'TemperatureController', 'TIC'),
  INSTR('inst-lic', 'Level Controller (DCS)', 'pid.instruments.shared_display', 'LevelController', 'LIC'),
  INSTR('inst-computer', 'Computer Function', 'pid.instruments.computer_function', 'Sensor', 'IC'),
  INSTR('inst-plc', 'Logic / PLC', 'pid.instruments.logic', 'Sensor', 'UC'),
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

/** Fallback stencils used by the adapter when a model element is not in the catalog. */
export const DEFAULT_STENCILS = {
  equipment: 'pid.vessels.tank_vessel',
  valve: 'pid.valves.gate_valve',
  instrument: 'pid.instruments.discrete',
} as const;

const EQUIPMENT_STENCIL_BY_CLASS = buildClassMap('Equipment');
const VALVE_STENCIL_BY_CLASS = buildClassMap('PipingComponent');
const INSTRUMENT_STENCIL_BY_CLASS = buildClassMap('ProcessInstrument');

function buildClassMap(elementType: SymbolElementType): Map<string, string> {
  const map = new Map<string, string>();
  for (const item of SYMBOL_CATALOG) {
    if (item.elementType === elementType && !map.has(item.componentClass)) {
      map.set(item.componentClass, item.stencil);
    }
  }
  return map;
}

/**
 * DEXPI RDL `ComponentClass` values that name the same symbol as a catalog
 * entry but under a different string. Real DEXPI example P&IDs use these
 * routinely; without the alias they silently fall through to
 * `DEFAULT_STENCILS` — a *different-looking* shape (e.g. a plate heat
 * exchanger rendered as the default tank/vessel outline, a reducer rendered
 * as a gate valve), not just an imprecise one. Found via the
 * `tools/dexpi-conformance/` regression suite; extend as new gaps surface.
 */
const RDL_CLASS_ALIASES: Record<string, string> = {
  // Equipment
  Tank: 'StorageTank',
  Vessel: 'VerticalVessel',
  PressureVessel: 'VerticalVessel',
  ProcessColumn: 'DistillationColumn',
  PlateAndShellHeatExchanger: 'PlateHeatExchanger',
  ReciprocatingPump: 'PositiveDisplacementPump',
  DisplacementPump: 'PositiveDisplacementPump',
  // Valves
  ShutOffValve: 'GateValve',
  TightShutOffValve: 'GateValve',
  OperatedValve: 'GateValve',
  SwingCheckValve: 'CheckValve',
  SpringLoadedGlobeSafetyValve: 'SafetyReliefValve',
  SpringLoadedAngleGlobeSafetyValve: 'SafetyReliefValve',
  AngleSafetyValve: 'SafetyReliefValve',
  // Fittings
  PipeReducer: 'Reducer',
  RestrictionOrifice: 'OrificePlate',
};

function resolveComponentClass(componentClass: string): string {
  return RDL_CLASS_ALIASES[componentClass] ?? componentClass;
}

/** Resolves the stencil id to draw for a DEXPI model element. */
export function catalogStencilFor(elementType: SymbolElementType, componentClass: string): string {
  const cls = resolveComponentClass(componentClass);
  if (elementType === 'Equipment') {
    return EQUIPMENT_STENCIL_BY_CLASS.get(cls) ?? DEFAULT_STENCILS.equipment;
  }
  if (elementType === 'ProcessInstrument') {
    return INSTRUMENT_STENCIL_BY_CLASS.get(cls) ?? DEFAULT_STENCILS.instrument;
  }
  return VALVE_STENCIL_BY_CLASS.get(cls) ?? DEFAULT_STENCILS.valve;
}

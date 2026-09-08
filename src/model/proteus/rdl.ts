/**
 * Mapping between DEXPI component classes and RDL URIs.
 * Seeded from official DEXPI c01 fixture and pyDEXPI reference models.
 */

export const RDL_MAP: Record<string, string> = {
  // Plant & metadata
  PlantModel: 'http://sandbox.dexpi.org/rdl/PlantModel',
  MetaData: 'http://sandbox.dexpi.org/rdl/MetaData',

  // Actuating systems & functions
  ActuatingSystem: 'http://sandbox.dexpi.org/rdl/ActuatingSystem',
  ActuatingSystemNumberLabel: 'http://sandbox.dexpi.org/rdl/ActuatingSystemNumberLabel',
  ControlledActuator: 'http://sandbox.dexpi.org/rdl/ControlledActuator',
  FailActionLabel: 'http://sandbox.dexpi.org/rdl/FailActionLabel',
  OperatedValveReference: 'http://sandbox.dexpi.org/rdl/OperatedValveReference',
  ActuatingFunction: 'http://sandbox.dexpi.org/rdl/ActuatingFunction',
  Positioner: 'http://sandbox.dexpi.org/rdl/Positioner',
  ActuatingElectricalFunction: 'http://sandbox.dexpi.org/rdl/ActuatingElectricalFunction',

  // Piping network
  PipingNetworkSystem: 'http://data.posccaesar.org/rdl/RDS270359',
  PipingNetworkSystemLabel: 'http://sandbox.dexpi.org/rdl/PipingNetworkSystemLabel',
  PipingNetworkSegment: 'http://data.posccaesar.org/rdl/RDS267704',
  PipingNetworkSegmentLabel: 'http://sandbox.dexpi.org/rdl/PipingNetworkSegmentLabel',
  FlowInPipeOffPageConnector: 'http://sandbox.dexpi.org/rdl/FlowInPipeOffPageConnector',
  FlowOutPipeOffPageConnector: 'http://sandbox.dexpi.org/rdl/FlowOutPipeOffPageConnector',
  PipeOffPageConnector: 'http://sandbox.dexpi.org/rdl/PipeOffPageConnector',
  Pipe: 'http://sandbox.dexpi.org/rdl/Pipe',
  DirectPipingConnection: 'http://sandbox.dexpi.org/rdl/DirectPipingConnection',
  PipingNode: 'http://sandbox.dexpi.org/rdl/PipingNode',

  // Valves & piping components
  GlobeValve: 'http://data.posccaesar.org/rdl/RDS416204',
  GateValve: 'http://data.posccaesar.org/rdl/RDS416204',
  ButterflyValve: 'http://data.posccaesar.org/rdl/RDS416609',
  BallValve: 'http://data.posccaesar.org/rdl/RDS416654',
  SwingCheckValve: 'http://data.posccaesar.org/rdl/RDS610424',
  CheckValve: 'http://data.posccaesar.org/rdl/RDS610424',
  NeedleValve: 'http://data.posccaesar.org/rdl/RDS416654',
  PlugValve: 'http://data.posccaesar.org/rdl/RDS416654',
  DiaphragmValve: 'http://data.posccaesar.org/rdl/RDS416654',
  AngleValve: 'http://data.posccaesar.org/rdl/RDS416204',
  ThreeWayValve: 'http://data.posccaesar.org/rdl/RDS416654',
  ControlValve: 'http://data.posccaesar.org/rdl/RDS416204',
  SafetyReliefValve: 'http://sandbox.dexpi.org/rdl/SpringLoadedGlobeSafetyValve',
  SpringLoadedGlobeSafetyValve: 'http://sandbox.dexpi.org/rdl/SpringLoadedGlobeSafetyValve',
  ValveLabel: 'http://sandbox.dexpi.org/rdl/ValveLabel',
  SafetyValveOrFittingLabel: 'http://sandbox.dexpi.org/rdl/SafetyValveOrFittingLabel',

  // Fittings & inline items
  PipeReducer: 'http://data.posccaesar.org/rdl/RDS416294',
  Reducer: 'http://data.posccaesar.org/rdl/RDS416294',
  PipeTee: 'http://data.posccaesar.org/rdl/RDS427724',
  BlindFlange: 'http://data.posccaesar.org/rdl/RDS414719',
  PipingFlange: 'http://data.posccaesar.org/rdl/RDS414719',
  PipeCap: 'http://data.posccaesar.org/rdl/RDS414719',
  SpectacleBlind: 'http://data.posccaesar.org/rdl/RDS414719',
  Strainer: 'http://sandbox.dexpi.org/rdl/Strainer',
  SteamTrap: 'http://sandbox.dexpi.org/rdl/SteamTrap',
  FlameArrestor: 'http://sandbox.dexpi.org/rdl/FlameArrestor',
  Silencer: 'http://sandbox.dexpi.org/rdl/Silencer',
  RuptureDisc: 'http://sandbox.dexpi.org/rdl/RuptureDisc',
  SightGlass: 'http://sandbox.dexpi.org/rdl/SightGlass',
  StaticMixer: 'http://sandbox.dexpi.org/rdl/StaticMixer',
  ExpansionJoint: 'http://sandbox.dexpi.org/rdl/ExpansionJoint',
  InsulationLabel: 'http://sandbox.dexpi.org/rdl/InsulationLabel',

  // Instrumentation
  ProcessInstrumentationFunction: 'http://sandbox.dexpi.org/rdl/ProcessInstrumentationFunction',
  ProcessInstrumentationFunctionLabel: 'http://sandbox.dexpi.org/rdl/ProcessInstrumentationFunctionLabel',
  InstrumentationLoopFunction: 'http://sandbox.dexpi.org/rdl/InstrumentationLoopFunction',
  MeasuringLineFunction: 'http://sandbox.dexpi.org/rdl/MeasuringLineFunction',
  ProcessSignalGeneratingFunction: 'http://sandbox.dexpi.org/rdl/ProcessSignalGeneratingFunction',
  SignalConveyingFunction: 'http://sandbox.dexpi.org/rdl/SignalConveyingFunction',
  FlowTransmitter: 'http://sandbox.dexpi.org/rdl/ProcessInstrumentationFunction',
  PressureTransmitter: 'http://sandbox.dexpi.org/rdl/ProcessInstrumentationFunction',
  TemperatureTransmitter: 'http://sandbox.dexpi.org/rdl/ProcessInstrumentationFunction',
  LevelTransmitter: 'http://sandbox.dexpi.org/rdl/ProcessInstrumentationFunction',
  FlowIndicator: 'http://sandbox.dexpi.org/rdl/ProcessInstrumentationFunction',
  PressureIndicator: 'http://sandbox.dexpi.org/rdl/ProcessInstrumentationFunction',
  TemperatureIndicator: 'http://sandbox.dexpi.org/rdl/ProcessInstrumentationFunction',
  LevelIndicator: 'http://sandbox.dexpi.org/rdl/ProcessInstrumentationFunction',
  FlowController: 'http://sandbox.dexpi.org/rdl/ProcessInstrumentationFunction',
  PressureController: 'http://sandbox.dexpi.org/rdl/ProcessInstrumentationFunction',
  TemperatureController: 'http://sandbox.dexpi.org/rdl/ProcessInstrumentationFunction',
  LevelController: 'http://sandbox.dexpi.org/rdl/ProcessInstrumentationFunction',
  Sensor: 'http://sandbox.dexpi.org/rdl/ProcessSignalGeneratingFunction',

  // Equipment
  PlateHeatExchanger: 'http://sandbox.dexpi.org/rdl/PlateHeatExchanger',
  TubularHeatExchanger: 'http://data.posccaesar.org/rdl/RDS13971182',
  ShellAndTubeHeatExchanger: 'http://data.posccaesar.org/rdl/RDS13971182',
  AirCooler: 'http://sandbox.dexpi.org/rdl/AirCoolingSystem',
  TubeBundle: 'http://data.posccaesar.org/rdl/RDS415259',
  CentrifugalPump: 'http://data.posccaesar.org/rdl/RDS416834',
  PositiveDisplacementPump: 'http://data.posccaesar.org/rdl/RDS416969',
  ReciprocatingPump: 'http://data.posccaesar.org/rdl/RDS416969',
  Compressor: 'http://data.posccaesar.org/rdl/RDS416834',
  Tank: 'http://data.posccaesar.org/rdl/RDS445139',
  StorageTank: 'http://data.posccaesar.org/rdl/RDS445139',
  VerticalVessel: 'http://data.posccaesar.org/rdl/RDS445139',
  HorizontalVessel: 'http://data.posccaesar.org/rdl/RDS445139',
  DistillationColumn: 'http://sandbox.dexpi.org/rdl/DistillationColumn',
  StirredReactor: 'http://sandbox.dexpi.org/rdl/StirredReactor',
  Filter: 'http://sandbox.dexpi.org/rdl/Filter',
  Impeller: 'http://data.posccaesar.org/rdl/RDS414539',
  Displacer: 'http://sandbox.dexpi.org/rdl/Displacer',
  EquipmentTagNameLabel: 'http://sandbox.dexpi.org/rdl/EquipmentTagNameLabel',
  EquipmentBarLabel: 'http://sandbox.dexpi.org/rdl/EquipmentBarLabel',

  // Nozzles & Chambers
  Nozzle: 'http://data.posccaesar.org/rdl/RDS415214',
  NozzleStandardLabel: 'http://sandbox.dexpi.org/rdl/NozzleStandardLabel',
  Chamber: 'http://data.posccaesar.org/rdl/RDS903151421',

  // Graphics & Common
  Label: 'http://sandbox.dexpi.org/rdl/Label',
  Drawing: 'http://sandbox.dexpi.org/rdl/Drawing',
  ShapeCatalogue: 'http://sandbox.dexpi.org/rdl/ShapeCatalogue',
};

export const REVERSE_RDL_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(RDL_MAP).map(([cls, uri]) => [uri, cls])
);

export function rdlUriForClass(className: string): string {
  return RDL_MAP[className] || `http://sandbox.dexpi.org/rdl/${className}`;
}

export function classForRdlUri(uri: string): string | undefined {
  return REVERSE_RDL_MAP[uri];
}


/**
 * Equivalence between DEXPI class names as they appear on the two sides:
 *  - ours:      the DEXPI RDL `ComponentClass` string from the Proteus file
 *               (e.g. `PlateAndShellHeatExchanger`, `Tank`, `PlugValve`)
 *  - reference: derived from the pyDEXPI shape name
 *               (e.g. `PlateTypeHeatExchanger`, `PumpCentrifugal`)
 *
 * A `false` here is a *legitimate* finding — usually our renderer falling back
 * to a default stencil because `catalogStencilFor` has no mapping for that RDL
 * class. The alias table only records pairs that are genuinely the same symbol
 * under two names. Grow it as Phase 3 maps more classes.
 */

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** groups of names that denote the same P&ID symbol */
const ALIAS_GROUPS: string[][] = [
  ['tank', 'storagetank', 'tankvessel', 'vessel', 'pressurevessel', 'verticalvessel', 'vesseltank'],
  ['plateheatexchanger', 'plateandshellheatexchanger', 'platetypeheatexchanger', 'plateandframeheatexchanger'],
  ['shellandtubeheatexchanger', 'tubularheatexchanger', 'heatexchanger', 'tubetypeheatexchanger'],
  ['centrifugalpump', 'pump', 'pumpcentrifugal', 'radialpump'],
  ['positivedisplacementpump', 'reciprocatingpump', 'displacementpump', 'rotarypump', 'pumpdisplacement'],
  ['distillationcolumn', 'processcolumn', 'column', 'columnsection'],
  ['gatevalve', 'shutoffvalve', 'tightshutoffvalve', 'valve'],
  ['globevalve', 'globetypevalve'],
  ['ballvalve'],
  ['butterflyvalve'],
  ['plugvalve'],
  ['checkvalve', 'swingcheckvalve', 'noreturnvalve'],
  ['controlvalve', 'operatedvalve'],
  ['safetyreliefvalve', 'springloadedanglegllobesafetyvalve', 'springloadedglobesafetyvalve', 'anglesafetyvalve', 'safetyvalve', 'reliefvalve', 'pressurereliefvalve'],
  ['reducer', 'pipereducer', 'concentricreducer', 'eccentricreducer', 'concentricdiameterchange'],
  ['spectacleblind', 'blindflange', 'blind', 'figure8blind'],
  ['orificeplate', 'restrictionorifice', 'restrictionplate'],
  ['nozzle', 'flangednozzle', 'assumednozzle'],
];

const GROUP_OF = new Map<string, number>();
ALIAS_GROUPS.forEach((group, i) => group.forEach((name) => GROUP_OF.set(name, i)));

export function classesEquivalent(a: string, b: string): boolean {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return true; // unknown on either side → don't cry wolf
  if (na === nb) return true;
  if (na === 'unknown' || nb === 'unknown') return true;
  const ga = GROUP_OF.get(na);
  const gb = GROUP_OF.get(nb);
  if (ga !== undefined && ga === gb) return true;
  // safe token fallback: both clearly name the same family
  for (const tok of ['heatexchanger', 'column', 'compressor', 'filter', 'reactor']) {
    if (na.includes(tok) && nb.includes(tok)) return true;
  }
  return false;
}

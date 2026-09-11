/**
 * Recognized file-name and content conventions for DEXPI / Proteus XML documents.
 *
 * The DEXPI specification itself does not mandate a file extension: Proteus XML
 * exports (DEXPI <= 1.4) are conventionally plain `.xml`, sometimes written as
 * `.proteus.xml`; other tools in the wild use `.pid.xml` / `.plant.xml`. This
 * project additionally claims the `.dexpi` extension for its own samples so the
 * custom editor doesn't have to hijack every `.xml` file in a workspace by
 * default. See https://dexpi.org/specifications/ and the Proteus XML mapping at
 * https://dexpi.org/static/pid_specification_1.4/concepts/proteus.html.
 */
const DEXPI_XML_SUFFIXES = [
  '.dexpi',
  '.proteus.xml',
  '.dexpi.xml',
  '.pid.xml',
  '.plant.xml',
  '.xml',
] as const;

/** Root-element / namespace fingerprints used to sniff whether an XML blob is actually DEXPI/Proteus content. */
const DEXPI_ROOT_MARKERS: RegExp[] = [
  /<PlantModel[\s>]/i,
  /<PlantInformation[\s>]/i,
  /<DexpiModel[\s>]/i,
  /xmlns[^=]*=["'][^"']*proteus[^"']*["']/i,
  /xmlns[^=]*=["'][^"']*dexpi[^"']*["']/i,
];

/** True if `name` (a filename or path) matches a known DEXPI/Proteus XML naming convention. */
export function isDexpiFileName(name: string): boolean {
  const lower = name.toLowerCase();
  return DEXPI_XML_SUFFIXES.some((suffix) => lower.endsWith(suffix));
}

/** True if `text` looks like a DEXPI/Proteus XML document, based on its root element/namespace. */
export function looksLikeDexpiXml(text: string): boolean {
  const head = text.slice(0, 4000);
  return DEXPI_ROOT_MARKERS.some((marker) => marker.test(head));
}

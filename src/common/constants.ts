export const EXTENSION_ID = 'osiris-dexpi';
export const CUSTOM_EDITOR_VIEW_TYPE = 'osiris.dexpiEditor';
/** Secondary registration of the same editor, contributed at "option" priority for generic `*.xml` files
 *  (Proteus/DEXPI XML has no reserved extension of its own) so it doesn't hijack every XML file by default. */
export const CUSTOM_EDITOR_VIEW_TYPE_XML = 'osiris.dexpiEditor.xml';
export const CUSTOM_EDITOR_VIEW_TYPES = [CUSTOM_EDITOR_VIEW_TYPE, CUSTOM_EDITOR_VIEW_TYPE_XML] as const;

export const COMMANDS = {
  OPEN_DESIGN: 'osiris-dexpi.openDesign',
  OPEN_SOURCE: 'osiris-dexpi.openSource',
  OPEN_ARCHIVE: 'osiris-dexpi.openArchive',
  EXPORT_SVG: 'osiris-dexpi.exportSvg',
  VALIDATE: 'osiris-dexpi.validate',
  START_MCP: 'osiris-dexpi.startMcpServer',
} as const;

export const VIEW_IDS = {
  CONTAINER: 'osirisPid',
  SYMBOLS: 'osiris.pidSymbols',
  PROPERTIES: 'osiris.pidProperties',
} as const;

export const PROTEUS_XML_DEFAULTS = {
  SCHEMA_VERSION: '4.1.1',
  ORIGINATING_SYSTEM: 'osiris-dexpi',
  DISCIPLINE: 'Piping and Instrumentation',
} as const;

export const OSIRIS_THEME = {
  ACCENT_PRIMARY: '#00f2fe',
  ACCENT_PRIMARY_SOFT: 'rgba(0, 242, 254, 0.14)',
  ACCENT_SECONDARY: '#ff2a85',
  ACCENT_SECONDARY_SOFT: 'rgba(255, 42, 133, 0.14)',
  DARK_BG: '#0d1117',
  DARK_SURFACE: '#161b22',
  DARK_BORDER: '#30363d',
  DARK_HOVER: '#21262d',
  LIGHT_BG: '#ffffff',
  LIGHT_SURFACE: '#f6f8fa',
  LIGHT_BORDER: '#d0d7de',
  LIGHT_HOVER: '#eaeef2',
  FONT_MONO: "'Fira Code', ui-monospace, Menlo, Consolas, monospace",
} as const;


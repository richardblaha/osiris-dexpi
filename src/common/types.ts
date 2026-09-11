import type { DexpiModel } from '../model/classes/dexpiModel';
import type { PidView } from '../model/view/projection';
import type { SymbolCatalogItem } from '../panel/symbolPalette';

export type ViewMode = 'design' | 'source';

export interface WebviewState {
  readOnly?: boolean;
  selectedElementId?: string;
  zoom?: number;
}

/** Snapshot of the selected canvas element, shown in the Properties panel. */
export interface SelectionInfo {
  id: string;
  elementType: string;
  componentClass: string;
  tagName: string;
  isEdge: boolean;
  attributes: Record<string, { value: string; units?: string }>;
}

// Messages from Extension host to the custom-editor webview
export type ExtensionToWebviewMessage =
  | { type: 'init'; content: string; model?: DexpiModel; view?: PidView }
  | { type: 'updateModel'; model?: DexpiModel; view?: PidView; content: string }
  | { type: 'insertSymbol'; item: SymbolCatalogItem }
  | { type: 'updateElement'; elementId: string; property: string; value: string }
  | { type: 'selectElement'; elementId: string | null }
  | { type: 'exportSvg' }
  | { type: 'validationResult'; result: ValidationReport };

// Messages from the custom-editor webview to the Extension host
export type WebviewToExtensionMessage =
  | { type: 'ready' }
  | { type: 'modelChanged'; model?: DexpiModel; view?: PidView; xmlContent?: string }
  | { type: 'selectionChanged'; selection: SelectionInfo | null }
  | { type: 'requestValidation' }
  | { type: 'save' }
  | { type: 'svgExported'; svg: string };

export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  elementId?: string;
  elementType?: string;
}

export interface ValidationReport {
  isValid: boolean;
  issues: ValidationIssue[];
  summary: {
    equipmentCount: number;
    pipingSegmentsCount: number;
    instrumentsCount: number;
    errorsCount: number;
    warningsCount: number;
  };
}

// IPC Messages between MCP Server and VS Code Extension
export interface McpIpcRequest {
  id: string;
  method:
    | 'getActivePid'
    | 'getPidStructure'
    | 'addEquipment'
    | 'connectPiping'
    | 'updateAttributes'
    | 'deleteElement'
    | 'reversePipingFlow'
    | 'splitPiping'
    | 'validateDexpi';
  params?: Record<string, unknown>;
}

export interface McpIpcResponse {
  id: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

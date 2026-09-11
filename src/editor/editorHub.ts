import * as vscode from 'vscode';
import type { DexpiModel } from '../model/classes/dexpiModel';
import { SelectionInfo } from '../common/types';
import { SymbolCatalogItem } from '../panel/symbolPalette';

interface ActiveEditor {
  panel: vscode.WebviewPanel;
  document: vscode.TextDocument;
  model: DexpiModel | null;
  selection: SelectionInfo | null;
}

/**
 * Single point of contact between the custom P&ID editor(s) and the sidebar
 * "P&ID" panel views. VS Code webview views and custom-editor webviews cannot
 * message each other directly, so everything routes through this extension-host
 * singleton.
 */
class EditorHub {
  private active: ActiveEditor | null = null;
  private readonly editors = new Map<vscode.WebviewPanel, ActiveEditor>();

  private readonly _onDidChangeModel = new vscode.EventEmitter<DexpiModel | null>();
  readonly onDidChangeModel = this._onDidChangeModel.event;

  private readonly _onDidChangeSelection = new vscode.EventEmitter<SelectionInfo | null>();
  readonly onDidChangeSelection = this._onDidChangeSelection.event;

  private readonly _onDidChangeActive = new vscode.EventEmitter<boolean>();
  /** Fires with `true` when a P&ID editor is focused, `false` when none is. */
  readonly onDidChangeActive = this._onDidChangeActive.event;

  register(panel: vscode.WebviewPanel, document: vscode.TextDocument): void {
    const entry: ActiveEditor = { panel, document, model: null, selection: null };
    this.editors.set(panel, entry);
    this.setActive(entry);
  }

  unregister(panel: vscode.WebviewPanel): void {
    const entry = this.editors.get(panel);
    this.editors.delete(panel);
    if (this.active === entry) {
      const next = this.editors.values().next().value ?? null;
      this.setActive(next);
    }
  }

  /** Called from `onDidChangeViewState` when a panel becomes the active one. */
  focus(panel: vscode.WebviewPanel): void {
    const entry = this.editors.get(panel);
    if (entry && this.active !== entry) this.setActive(entry);
  }

  private setActive(entry: ActiveEditor | null): void {
    this.active = entry;
    this._onDidChangeActive.fire(entry != null);
    this._onDidChangeModel.fire(entry?.model ?? null);
    this._onDidChangeSelection.fire(entry?.selection ?? null);
  }

  get hasActive(): boolean {
    return this.active != null;
  }

  get activeModel(): DexpiModel | null {
    return this.active?.model ?? null;
  }

  get activeDocument(): vscode.TextDocument | undefined {
    return this.active?.document;
  }

  get activeSelection(): SelectionInfo | null {
    return this.active?.selection ?? null;
  }

  updateModel(panel: vscode.WebviewPanel, model: DexpiModel): void {
    const entry = this.editors.get(panel);
    if (!entry) return;
    entry.model = model;
    if (entry === this.active) this._onDidChangeModel.fire(model);
  }

  updateSelection(panel: vscode.WebviewPanel, selection: SelectionInfo | null): void {
    const entry = this.editors.get(panel);
    if (!entry) return;
    entry.selection = selection;
    if (entry === this.active) this._onDidChangeSelection.fire(selection);
  }

  insertSymbol(item: SymbolCatalogItem): boolean {
    if (!this.active) return false;
    void this.active.panel.webview.postMessage({ type: 'insertSymbol', item });
    return true;
  }

  patchElement(elementId: string, property: string, value: string): boolean {
    if (!this.active) return false;
    void this.active.panel.webview.postMessage({ type: 'updateElement', elementId, property, value });
    return true;
  }

  requestSvgExport(): boolean {
    if (!this.active) return false;
    void this.active.panel.webview.postMessage({ type: 'exportSvg' });
    return true;
  }

  dispose(): void {
    this._onDidChangeModel.dispose();
    this._onDidChangeSelection.dispose();
    this._onDidChangeActive.dispose();
  }
}

export const editorHub = new EditorHub();

import * as vscode from 'vscode';
import type { DexpiModel } from '../model/classes/dexpiModel';
import type { PidView } from '../model/view/projection';
import { ProteusReader } from '../model/proteus/reader';
import { ProteusWriter } from '../model/proteus/writer';
import { projectToView } from '../model/view/projection';
import { applyViewToModel } from '../model/view/apply';

export class DexpiSyncManager {
  private latestModel: DexpiModel | null = null;
  private isDirty = false;
  private isApplyingLocalEdit = false;

  constructor(
    private readonly document: vscode.TextDocument,
    private readonly webviewPanel: vscode.WebviewPanel
  ) {
    try {
      this.latestModel = ProteusReader.read(document.getText()).model;
    } catch {
      // Document might not be loaded or parsed yet
    }
  }

  public getModel(): DexpiModel | null {
    return this.latestModel;
  }

  /**
   * Called when webview informs us that the visual graph model has changed.
   * Keeps changes in host memory without applying immediate WorkspaceEdit on every stroke.
   */
  public handleWebviewChange(viewOrModel: PidView | DexpiModel): void {
    if (this.isApplyingLocalEdit) return;

    if ('nodes' in viewOrModel) {
      if (this.latestModel) {
        this.latestModel = applyViewToModel(viewOrModel as PidView, this.latestModel);
      }
    } else {
      this.latestModel = viewOrModel as DexpiModel;
    }
    this.isDirty = true;
  }

  /**
   * Flushes in-memory changes back into the TextDocument.
   * Invoked on explicit Save or when toggling from Design to Source view.
   */
  public async flushToDocument(): Promise<void> {
    if (!this.isDirty || !this.latestModel || this.isApplyingLocalEdit) return;

    try {
      this.isApplyingLocalEdit = true;
      const xml = ProteusWriter.write(this.latestModel);

      const edit = new vscode.WorkspaceEdit();
      const fullRange = new vscode.Range(
        this.document.positionAt(0),
        this.document.positionAt(this.document.getText().length)
      );

      edit.replace(this.document.uri, fullRange, xml);
      await vscode.workspace.applyEdit(edit);
      this.isDirty = false;
    } catch (err) {
      console.error('Failed to flush in-memory DEXPI model to TextDocument:', err);
    } finally {
      this.isApplyingLocalEdit = false;
    }
  }

  /**
   * Called when the underlying TextDocument changed (e.g. text editor edit, external change).
   * Notifies the webview to update its maxGraph canvas.
   */
  public handleDocumentChange(): void {
    if (this.isApplyingLocalEdit) return;

    try {
      const text = this.document.getText();
      const { model } = ProteusReader.read(text);
      this.latestModel = model;
      this.isDirty = false;
      const view = projectToView(model);
      this.webviewPanel.webview.postMessage({
        type: 'updateModel',
        model,
        view,
        content: text,
      });
    } catch (err) {
      console.warn('Could not parse Proteus XML after document change:', err);
    }
  }

  public dispose(): void {
    this.isDirty = false;
  }
}

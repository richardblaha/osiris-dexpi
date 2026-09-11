import * as vscode from 'vscode';
import { CUSTOM_EDITOR_VIEW_TYPES } from '../common/constants';
import { WebviewToExtensionMessage } from '../common/types';
import { ProteusReader } from '../model/proteus/reader';
import { projectToView } from '../model/view/projection';
import { DexpiValidator } from '../model/validator';
import { DexpiSyncManager } from './syncManager';
import { editorHub } from './editorHub';

export class DexpiEditorProvider implements vscode.CustomTextEditorProvider {
  private static readonly activeSyncManagers = new Map<vscode.WebviewPanel, DexpiSyncManager>();
  private readonly validator = new DexpiValidator();
  private readonly diagnosticCollection: vscode.DiagnosticCollection;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('osiris-dexpi');
    context.subscriptions.push(this.diagnosticCollection);
  }

  public static async flushAll(): Promise<void> {
    for (const sm of DexpiEditorProvider.activeSyncManagers.values()) {
      await sm.flushToDocument();
    }
  }

  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new DexpiEditorProvider(context);
    // Bind the same provider under both view types: the narrow, DEXPI-specific
    // extensions (.dexpi, .proteus.xml, ...) get it as the default editor, while
    // generic *.xml files (the official Proteus/DEXPI extension, but shared with
    // countless non-DEXPI documents) only offer it as an "Open With" option.
    const disposables = CUSTOM_EDITOR_VIEW_TYPES.map((viewType) =>
      vscode.window.registerCustomEditorProvider(viewType, provider, {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: true,
      })
    );
    return vscode.Disposable.from(...disposables);
  }

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'dist'),
        vscode.Uri.joinPath(this.context.extensionUri, 'media'),
      ],
    };

    const syncManager = new DexpiSyncManager(document, webviewPanel);
    DexpiEditorProvider.activeSyncManagers.set(webviewPanel, syncManager);

    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

    editorHub.register(webviewPanel, document);
    this.runValidation(document, webviewPanel);

    const changeDocSubscription = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() === document.uri.toString()) {
        syncManager.handleDocumentChange();
        this.runValidation(document, webviewPanel);
      }
    });

    const willSaveSubscription = vscode.workspace.onWillSaveTextDocument(async (e) => {
      if (e.document.uri.toString() === document.uri.toString()) {
        await syncManager.flushToDocument();
      }
    });

    const viewStateSubscription = webviewPanel.onDidChangeViewState((e) => {
      if (e.webviewPanel.active) {
        editorHub.focus(webviewPanel);
      }
    });

    webviewPanel.webview.onDidReceiveMessage(async (msg: WebviewToExtensionMessage | any) => {
      switch (msg.type) {
        case 'ready': {
          const content = document.getText();
          try {
            const { model } = ProteusReader.read(content);
            editorHub.updateModel(webviewPanel, model);
            const view = projectToView(model);
            void webviewPanel.webview.postMessage({ type: 'init', content, model, view });
          } catch (err) {
            console.error('Failed to parse DEXPI model on ready:', err);
          }
          break;
        }

        case 'modelChanged': {
          syncManager.handleWebviewChange(msg.model || msg.view);
          const m = syncManager.getModel();
          if (m) editorHub.updateModel(webviewPanel, m);
          break;
        }

        case 'save': {
          await syncManager.flushToDocument();
          await document.save();
          break;
        }

        case 'selectionChanged': {
          editorHub.updateSelection(webviewPanel, msg.selection);
          break;
        }

        case 'requestValidation': {
          this.runValidation(document, webviewPanel);
          break;
        }

        case 'svgExported': {
          await this.saveSvg(document, msg.svg);
          break;
        }
      }
    });

    webviewPanel.onDidDispose(() => {
      DexpiEditorProvider.activeSyncManagers.delete(webviewPanel);
      changeDocSubscription.dispose();
      willSaveSubscription.dispose();
      viewStateSubscription.dispose();
      editorHub.unregister(webviewPanel);
      syncManager.dispose();
      this.diagnosticCollection.delete(document.uri);
    });
  }

  private async saveSvg(document: vscode.TextDocument, svg: string): Promise<void> {
    if (!svg) {
      vscode.window.showWarningMessage('Nothing to export yet.');
      return;
    }
    const base = document.uri.path.replace(/\.[^./]+$/, '');
    const target = await vscode.window.showSaveDialog({
      defaultUri: document.uri.with({ path: `${base}.svg` }),
      filters: { 'SVG image': ['svg'] },
    });
    if (!target) return;
    await vscode.workspace.fs.writeFile(target, Buffer.from(svg, 'utf8'));
    vscode.window.showInformationMessage(`Exported diagram to ${vscode.workspace.asRelativePath(target)}`);
  }

  private runValidation(document: vscode.TextDocument, webviewPanel?: vscode.WebviewPanel): void {
    try {
      const text = document.getText();
      const { model } = ProteusReader.read(text);
      const report = this.validator.validate(model);

      const diagnostics: vscode.Diagnostic[] = report.issues.map((issue) => {
        const severity =
          issue.severity === 'error'
            ? vscode.DiagnosticSeverity.Error
            : issue.severity === 'warning'
            ? vscode.DiagnosticSeverity.Warning
            : vscode.DiagnosticSeverity.Information;

        const range = new vscode.Range(0, 0, 0, 0);
        const diag = new vscode.Diagnostic(
          range,
          `[${issue.code}] ${issue.message} (${issue.elementId || 'General'})`,
          severity
        );
        diag.source = 'DEXPI Validator';
        return diag;
      });

      this.diagnosticCollection.set(document.uri, diagnostics);

      if (webviewPanel) {
        void webviewPanel.webview.postMessage({ type: 'validationResult', result: report });
      }
    } catch (err) {
      console.warn('Validation error:', err);
    }
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview.css')
    );
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource}; img-src ${webview.cspSource} data:;">
  <link rel="stylesheet" href="${styleUri}">
  <title>Osiris DEXPI Editor</title>
</head>
<body class="osiris-dexpi-body">
  <div id="graph-container" class="graph-canvas"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

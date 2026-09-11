import * as vscode from 'vscode';
import { VIEW_IDS } from '../common/constants';
import { editorHub } from '../editor/editorHub';
import { catalogItemById } from './symbolPalette';

type ViewKind = 'symbols' | 'properties';

abstract class PidWebviewViewProvider implements vscode.WebviewViewProvider {
  protected view: vscode.WebviewView | undefined;
  protected readonly disposables: vscode.Disposable[] = [];

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly kind: ViewKind
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'dist')],
    };
    webviewView.webview.html = this.getHtml(webviewView.webview);

    this.disposables.push(
      webviewView.webview.onDidReceiveMessage((msg) => this.onMessage(msg)),
      webviewView.onDidDispose(() => {
        this.disposables.forEach((d) => d.dispose());
        this.disposables.length = 0;
        this.view = undefined;
      })
    );

    this.onResolved();
  }

  protected post(message: unknown): void {
    void this.view?.webview.postMessage(message);
  }

  protected abstract onResolved(): void;
  protected abstract onMessage(message: any): void;

  private getHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'dist', 'panel.js'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'dist', 'panel.css'));
    const nonce = getNonce();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data:;">
  <link rel="stylesheet" href="${styleUri}">
  <title>P&amp;ID</title>
</head>
<body data-view="${this.kind}">
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

export class SymbolsViewProvider extends PidWebviewViewProvider {
  static readonly viewId = VIEW_IDS.SYMBOLS;

  constructor(extensionUri: vscode.Uri) {
    super(extensionUri, 'symbols');
  }

  protected onResolved(): void {
    this.disposables.push(editorHub.onDidChangeActive((active) => this.post({ type: 'state', active })));
  }

  protected onMessage(message: any): void {
    if (message?.type === 'ready') {
      this.post({ type: 'state', active: editorHub.hasActive });
    } else if (message?.type === 'insert' && typeof message.itemId === 'string') {
      const item = catalogItemById(message.itemId);
      if (item && !editorHub.insertSymbol(item)) {
        vscode.window.showWarningMessage('Open a P&ID diagram before placing symbols.');
      }
    }
  }
}

export class PropertiesViewProvider extends PidWebviewViewProvider {
  static readonly viewId = VIEW_IDS.PROPERTIES;

  constructor(extensionUri: vscode.Uri) {
    super(extensionUri, 'properties');
  }

  protected onResolved(): void {
    this.disposables.push(
      editorHub.onDidChangeSelection((selection) => this.post({ type: 'selection', selection })),
      editorHub.onDidChangeActive((active) => {
        this.post({ type: 'state', active });
        if (active) this.post({ type: 'selection', selection: editorHub.activeSelection });
      })
    );
  }

  protected onMessage(message: any): void {
    if (message?.type === 'ready') {
      this.post({ type: 'state', active: editorHub.hasActive });
      this.post({ type: 'selection', selection: editorHub.activeSelection });
    } else if (message?.type === 'patch') {
      editorHub.patchElement(String(message.elementId), String(message.property), String(message.value));
    }
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

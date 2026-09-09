import * as vscode from 'vscode';
import * as http from 'http';
import { COMMANDS, CUSTOM_EDITOR_VIEW_TYPE } from './common/constants';
import { McpIpcRequest, McpIpcResponse } from './common/types';
import { DexpiEditorProvider } from './editor/dexpiEditorProvider';
import { editorHub } from './editor/editorHub';
import { SymbolsViewProvider, PropertiesViewProvider } from './panel/pidViews';
import { DexpiModelService } from './model/service';

let ipcServer: http.Server | null = null;
let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext): void {
  outputChannel = vscode.window.createOutputChannel('Osiris DEXPI');
  outputChannel.appendLine('Activating Osiris DEXPI extension...');

  // 1. Register Custom Editor Provider + P&ID panel views
  context.subscriptions.push(DexpiEditorProvider.register(context));
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      SymbolsViewProvider.viewId,
      new SymbolsViewProvider(context.extensionUri),
      { webviewOptions: { retainContextWhenHidden: true } }
    ),
    vscode.window.registerWebviewViewProvider(
      PropertiesViewProvider.viewId,
      new PropertiesViewProvider(context.extensionUri),
      { webviewOptions: { retainContextWhenHidden: true } }
    ),
    { dispose: () => editorHub.dispose() }
  );

  // 2. Register Commands
  context.subscriptions.push(
    vscode.commands.registerCommand(COMMANDS.OPEN_DESIGN, async (uri?: vscode.Uri) => {
      const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
      if (targetUri) {
        await vscode.commands.executeCommand('vscode.openWith', targetUri, CUSTOM_EDITOR_VIEW_TYPE);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(COMMANDS.OPEN_SOURCE, async () => {
      // Flush in-memory canvas edits before switching to text editor
      await DexpiEditorProvider.flushAll();
      await vscode.commands.executeCommand('workbench.action.toggleEditorType');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(COMMANDS.EXPORT_SVG, () => {
      if (!editorHub.requestSvgExport()) {
        vscode.window.showWarningMessage('Open a P&ID diagram in the Design editor to export it.');
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(COMMANDS.VALIDATE, async () => {
      const activeDoc = getActiveDexpiDocument();
      if (!activeDoc) {
        vscode.window.showWarningMessage('No active DEXPI XML document found to validate.');
        return;
      }

      const service = DexpiModelService.fromXml(activeDoc.getText());
      const report = service.validate();

      if (report.isValid) {
        vscode.window.showInformationMessage(
          `DEXPI Diagram is valid: ${report.summary.equipmentCount} equipment, ${report.summary.pipingSegmentsCount} lines, ${report.summary.instrumentsCount} instruments.`
        );
      } else {
        vscode.window.showErrorMessage(
          `DEXPI Diagram has ${report.summary.errorsCount} error(s) and ${report.summary.warningsCount} warning(s). Check Problems panel.`
        );
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(COMMANDS.START_MCP, () => {
      vscode.window.showInformationMessage(
        `Embedded MCP server (osiris-dexpi-mcp) is ready and listening for active document buffer requests.`
      );
    })
  );

  // 3. Start Local IPC Server for MCP tools
  startIpcBridge(context);

  outputChannel.appendLine('Osiris DEXPI extension activated successfully.');
}

export function deactivate(): void {
  if (ipcServer) {
    ipcServer.close();
    ipcServer = null;
  }
}

function getActiveDexpiDocument(): vscode.TextDocument | undefined {
  // Prefer the document behind a focused Design editor (no active text editor then).
  const hubDoc = editorHub.activeDocument;
  if (hubDoc) return hubDoc;

  const activeEditor = vscode.window.activeTextEditor;
  if (activeEditor && (activeEditor.document.fileName.endsWith('.dexpi') || activeEditor.document.fileName.endsWith('.xml'))) {
    return activeEditor.document;
  }

  // Fallback: search open text documents
  const dexpiDocs = vscode.workspace.textDocuments.filter(
    (d) => d.fileName.endsWith('.dexpi') || d.fileName.endsWith('.xml')
  );
  return dexpiDocs[0];
}

function startIpcBridge(context: vscode.ExtensionContext): void {
  const config = vscode.workspace.getConfiguration('osirisDexpi');
  const port = config.get<number>('mcpPort') || 45123;

  ipcServer = http.createServer(async (req, res) => {
    if (req.method !== 'POST' || req.url !== '/mcp-bridge') {
      res.writeHead(404);
      res.end();
      return;
    }

    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body) as McpIpcRequest;
        const activeDoc = getActiveDexpiDocument();

        if (!activeDoc) {
          const resp: McpIpcResponse = {
            id: payload.id,
            success: false,
            error: 'No active DEXPI document open in VS Code buffer',
          };
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(resp));
          return;
        }

        const service = DexpiModelService.fromXml(activeDoc.getText());
        let resultData: unknown = null;

        switch (payload.method) {
          case 'getActivePid': {
            resultData = {
              filePath: activeDoc.uri.fsPath,
              content: activeDoc.getText(),
              model: service.model,
            };
            break;
          }

          case 'getPidStructure': {
            resultData = service.getStructure('vscode_buffer', activeDoc.uri.fsPath);
            break;
          }

          case 'addEquipment': {
            resultData = service.addEquipment(payload.params as any);
            await applyDocumentEdit(activeDoc, service.toXml());
            break;
          }

          case 'connectPiping': {
            resultData = service.connectPiping(payload.params as any);
            await applyDocumentEdit(activeDoc, service.toXml());
            break;
          }

          case 'updateAttributes': {
            resultData = service.updateAttributes(payload.params as any);
            await applyDocumentEdit(activeDoc, service.toXml());
            break;
          }

          case 'deleteElement': {
            resultData = service.deleteElement((payload.params as any).elementId);
            await applyDocumentEdit(activeDoc, service.toXml());
            break;
          }

          case 'reversePipingFlow': {
            resultData = service.reversePipingFlow((payload.params as any).segmentId);
            await applyDocumentEdit(activeDoc, service.toXml());
            break;
          }

          case 'splitPiping': {
            resultData = service.splitPiping(payload.params as any);
            await applyDocumentEdit(activeDoc, service.toXml());
            break;
          }

          case 'validateDexpi': {
            resultData = service.validate();
            break;
          }
        }

        const resp: McpIpcResponse = {
          id: payload.id,
          success: true,
          data: resultData,
        };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(resp));
      } catch (err: any) {
        const resp: McpIpcResponse = {
          id: 'error',
          success: false,
          error: err.message || 'Internal IPC error',
        };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(resp));
      }
    });
  });

  ipcServer.listen(port, '127.0.0.1', () => {
    outputChannel.appendLine(`MCP IPC Bridge listening on http://127.0.0.1:${port}/mcp-bridge`);
  });

  ipcServer.on('error', (err) => {
    outputChannel.appendLine(`MCP IPC Bridge error: ${err.message}`);
  });
}

async function applyDocumentEdit(document: vscode.TextDocument, newText: string): Promise<void> {
  const edit = new vscode.WorkspaceEdit();
  const range = new vscode.Range(
    document.positionAt(0),
    document.positionAt(document.getText().length)
  );
  edit.replace(document.uri, range, newText);
  await vscode.workspace.applyEdit(edit);
}


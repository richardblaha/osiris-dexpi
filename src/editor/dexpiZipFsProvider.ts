import * as vscode from 'vscode';
import * as fs from 'fs';
import AdmZip from 'adm-zip';

export const DEXPI_ZIP_SCHEME = 'dexpi-zip';

/**
 * Exposes a single entry inside a .zip archive as a normal virtual text file, so
 * the existing `DexpiEditorProvider` (a `CustomTextEditorProvider`) can open,
 * edit, and save a DEXPI/Proteus XML document that lives inside an archive
 * without any changes to the sync/model pipeline. Writes are re-packed into the
 * same archive, preserving every other entry (attachments, images, etc).
 */
export class DexpiZipFsProvider implements vscode.FileSystemProvider {
  private readonly _onDidChangeFile = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  readonly onDidChangeFile = this._onDidChangeFile.event;

  watch(): vscode.Disposable {
    return new vscode.Disposable(() => {});
  }

  stat(uri: vscode.Uri): vscode.FileStat {
    const { zipPath, entryName } = parseUri(uri);
    const zip = new AdmZip(zipPath);
    const entry = zip.getEntry(entryName);
    if (!entry) throw vscode.FileSystemError.FileNotFound(uri);
    const zipStat = fs.statSync(zipPath);
    return {
      type: vscode.FileType.File,
      ctime: zipStat.ctimeMs,
      mtime: zipStat.mtimeMs,
      size: entry.getData().length,
    };
  }

  readFile(uri: vscode.Uri): Uint8Array {
    const { zipPath, entryName } = parseUri(uri);
    const zip = new AdmZip(zipPath);
    const entry = zip.getEntry(entryName);
    if (!entry) throw vscode.FileSystemError.FileNotFound(uri);
    return new Uint8Array(entry.getData());
  }

  writeFile(uri: vscode.Uri, content: Uint8Array): void {
    const { zipPath, entryName } = parseUri(uri);
    const zip = new AdmZip(zipPath);
    if (zip.getEntry(entryName)) {
      zip.updateFile(entryName, Buffer.from(content));
    } else {
      zip.addFile(entryName, Buffer.from(content));
    }
    zip.writeZip(zipPath);
  }

  readDirectory(): [string, vscode.FileType][] {
    return [];
  }

  createDirectory(): void {
    throw vscode.FileSystemError.NoPermissions('Cannot create directories inside a DEXPI archive.');
  }

  delete(): void {
    throw vscode.FileSystemError.NoPermissions('Cannot delete entries from a DEXPI archive here.');
  }

  rename(): void {
    throw vscode.FileSystemError.NoPermissions('Cannot rename entries inside a DEXPI archive.');
  }
}

/** Builds the virtual URI for `entryName` inside the archive at `zipPath`. */
export function toDexpiZipUri(zipPath: string, entryName: string): vscode.Uri {
  return vscode.Uri.from({
    scheme: DEXPI_ZIP_SCHEME,
    path: `/${entryName}`,
    query: encodeURIComponent(zipPath),
  });
}

function parseUri(uri: vscode.Uri): { zipPath: string; entryName: string } {
  return {
    zipPath: decodeURIComponent(uri.query),
    entryName: uri.path.replace(/^\/+/, ''),
  };
}

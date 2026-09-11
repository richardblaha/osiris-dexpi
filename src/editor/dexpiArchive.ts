import * as vscode from 'vscode';
import AdmZip from 'adm-zip';
import { CUSTOM_EDITOR_VIEW_TYPE } from '../common/constants';
import { findDexpiCandidates } from '../model/archive';
import { toDexpiZipUri } from './dexpiZipFsProvider';

/**
 * Opens a DEXPI/Proteus XML document that's bundled inside a .zip archive
 * (a common real-world handover shape alongside attachments) in the visual
 * Design editor, extracting it in place via the `dexpi-zip:` virtual filesystem.
 */
export async function openDexpiArchive(uri?: vscode.Uri): Promise<void> {
  const zipUri = uri ?? (await pickZipFile());
  if (!zipUri) return;

  let zip: AdmZip;
  try {
    zip = new AdmZip(zipUri.fsPath);
  } catch (err: any) {
    vscode.window.showErrorMessage(`Could not read archive: ${err.message || err}`);
    return;
  }

  const candidates = findDexpiCandidates(zip);
  if (candidates.length === 0) {
    vscode.window.showWarningMessage('No DEXPI/Proteus XML document found inside this archive.');
    return;
  }

  let entryName: string;
  if (candidates.length === 1) {
    entryName = candidates[0].entryName;
  } else {
    const pick = await vscode.window.showQuickPick(
      candidates.map((c) => ({ label: c.entryName })),
      { placeHolder: 'Multiple DEXPI documents found in this archive — pick one to open' }
    );
    if (!pick) return;
    entryName = pick.label;
  }

  const virtualUri = toDexpiZipUri(zipUri.fsPath, entryName);
  await vscode.commands.executeCommand('vscode.openWith', virtualUri, CUSTOM_EDITOR_VIEW_TYPE);
}

async function pickZipFile(): Promise<vscode.Uri | undefined> {
  const picked = await vscode.window.showOpenDialog({
    canSelectMany: false,
    filters: { 'Zip Archive': ['zip'] },
    openLabel: 'Open DEXPI Archive',
  });
  return picked?.[0];
}

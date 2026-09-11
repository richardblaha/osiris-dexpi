import AdmZip from 'adm-zip';
import { isDexpiFileName, looksLikeDexpiXml } from '../common/fileTypes';

export interface DexpiArchiveCandidate {
  /** Full path of the entry inside the archive, e.g. "sheets/C01.xml". */
  entryName: string;
}

/**
 * Real-world DEXPI exchanges are frequently handed over as a zip alongside
 * referenced attachments (border drawings, custom stencil images, PDFs), or
 * simply as a compressed copy of a single Proteus/DEXPI XML file. There is no
 * single official DEXPI archive/container format (DEXPI 2.0 is expected to
 * define multi-file bundling), so this scans entries heuristically instead of
 * requiring a fixed layout.
 *
 * Returns the entry names most likely to be the DEXPI/Proteus document,
 * ranked by content sniffing when possible.
 */
export function findDexpiCandidates(zip: AdmZip): DexpiArchiveCandidate[] {
  const namedEntries = zip
    .getEntries()
    .filter((entry) => !entry.isDirectory)
    .filter((entry) => {
      const base = entry.entryName.split('/').pop() ?? entry.entryName;
      if (base.startsWith('.') || base.startsWith('~$')) return false;
      if (entry.entryName.startsWith('__MACOSX/')) return false;
      return isDexpiFileName(base);
    });

  const sniffed = namedEntries.filter((entry) => {
    try {
      return looksLikeDexpiXml(entry.getData().toString('utf8'));
    } catch {
      return false;
    }
  });

  const winners = sniffed.length > 0 ? sniffed : namedEntries;
  return winners.map((entry) => ({ entryName: entry.entryName }));
}

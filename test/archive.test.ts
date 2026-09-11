import AdmZip from 'adm-zip';
import { describe, expect, it } from 'vitest';
import { findDexpiCandidates } from '../src/model/archive';

const PLANT_MODEL_XML = `<?xml version="1.0" encoding="UTF-8"?>\n<PlantModel ID="PlantModel-001">\n  <PlantInformation SchemaVersion="4.1.1"/>\n</PlantModel>`;

describe('findDexpiCandidates', () => {
  it('finds a single DEXPI XML entry regardless of naming, ignoring attachments', () => {
    const zip = new AdmZip();
    zip.addFile('C01.xml', Buffer.from(PLANT_MODEL_XML, 'utf8'));
    zip.addFile('drawing-border.pdf', Buffer.from('%PDF-1.4 fake', 'utf8'));
    zip.addFile('logo.png', Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const candidates = findDexpiCandidates(zip);
    expect(candidates).toEqual([{ entryName: 'C01.xml' }]);
  });

  it('picks up alternate DEXPI extension conventions inside sub-folders', () => {
    const zip = new AdmZip();
    zip.addFile('sheets/unit-100.proteus.xml', Buffer.from(PLANT_MODEL_XML, 'utf8'));

    const candidates = findDexpiCandidates(zip);
    expect(candidates).toEqual([{ entryName: 'sheets/unit-100.proteus.xml' }]);
  });

  it('ignores macOS metadata and dotfiles even when they end in .xml', () => {
    const zip = new AdmZip();
    zip.addFile('C01.xml', Buffer.from(PLANT_MODEL_XML, 'utf8'));
    zip.addFile('__MACOSX/._C01.xml', Buffer.from(PLANT_MODEL_XML, 'utf8'));
    zip.addFile('.hidden.xml', Buffer.from(PLANT_MODEL_XML, 'utf8'));

    const candidates = findDexpiCandidates(zip);
    expect(candidates).toEqual([{ entryName: 'C01.xml' }]);
  });

  it('ranks by content sniffing when multiple .xml entries exist', () => {
    const zip = new AdmZip();
    zip.addFile('C01.xml', Buffer.from(PLANT_MODEL_XML, 'utf8'));
    zip.addFile('unrelated-config.xml', Buffer.from('<config><a/></config>', 'utf8'));

    const candidates = findDexpiCandidates(zip);
    expect(candidates).toEqual([{ entryName: 'C01.xml' }]);
  });

  it('falls back to every named candidate when content sniffing matches none', () => {
    const zip = new AdmZip();
    zip.addFile('a.dexpi', Buffer.from('<not-dexpi/>', 'utf8'));
    zip.addFile('b.proteus.xml', Buffer.from('<also-not-dexpi/>', 'utf8'));

    const candidates = findDexpiCandidates(zip).map((c) => c.entryName).sort();
    expect(candidates).toEqual(['a.dexpi', 'b.proteus.xml']);
  });

  it('returns nothing for an archive with no DEXPI-shaped entries', () => {
    const zip = new AdmZip();
    zip.addFile('readme.txt', Buffer.from('hello', 'utf8'));

    expect(findDexpiCandidates(zip)).toEqual([]);
  });
});

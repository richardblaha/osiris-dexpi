import { describe, expect, it } from 'vitest';
import { isDexpiFileName, looksLikeDexpiXml } from '../src/common/fileTypes';

describe('isDexpiFileName', () => {
  it('accepts the extension conventions used across DEXPI tooling', () => {
    expect(isDexpiFileName('simple-pid.dexpi')).toBe(true);
    expect(isDexpiFileName('C01V04-VER.EX01.xml')).toBe(true);
    expect(isDexpiFileName('C01V04-VER.EX01.proteus.xml')).toBe(true);
    expect(isDexpiFileName('plant.dexpi.xml')).toBe(true);
    expect(isDexpiFileName('unit-100.pid.xml')).toBe(true);
    expect(isDexpiFileName('area-1.plant.xml')).toBe(true);
    expect(isDexpiFileName('/some/dir/PID-101.XML')).toBe(true);
  });

  it('rejects unrelated file extensions', () => {
    expect(isDexpiFileName('readme.md')).toBe(false);
    expect(isDexpiFileName('notes.txt')).toBe(false);
    expect(isDexpiFileName('archive.zip')).toBe(false);
    expect(isDexpiFileName('package.json')).toBe(false);
  });
});

describe('looksLikeDexpiXml', () => {
  it('detects a Proteus/DEXPI PlantModel root element', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<PlantModel ID="PlantModel-001">\n  <PlantInformation SchemaVersion="4.1.1"/>\n</PlantModel>`;
    expect(looksLikeDexpiXml(xml)).toBe(true);
  });

  it('rejects an unrelated XML document', () => {
    const xml = `<?xml version="1.0"?><project><name>foo</name></project>`;
    expect(looksLikeDexpiXml(xml)).toBe(false);
  });
});

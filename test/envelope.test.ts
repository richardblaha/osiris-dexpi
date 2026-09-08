import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { fromEnvelope, toEnvelope, DexpiEnvelope } from '../src/model/envelope';
import { classForUri } from '../src/model/uris';
import { SCHEMA } from '../src/model/registry';

describe('pyDEXPI JSON Envelope SerDes', () => {
  const oraclePath = path.resolve(__dirname, '../samples/reference/c01.pydexpi.json');
  const oracleJson: DexpiEnvelope = JSON.parse(fs.readFileSync(oraclePath, 'utf-8'));

  it('deserializes c01.pydexpi.json into a valid DexpiModel domain tree', () => {
    const model = fromEnvelope(oracleJson);

    expect(model.id).toBe(oracleJson.id);
    expect(model.conceptualModel).toBeDefined();

    const cm = model.conceptualModel;
    expect(cm.taggedPlantItems).toHaveLength(5);
    expect(cm.pipingNetworkSystems).toHaveLength(11);
    expect(cm.processInstrumentationFunctions).toHaveLength(4);
    expect(cm.instrumentationLoopFunctions).toHaveLength(4);
    expect(cm.actuatingSystems).toHaveLength(3);

    expect(model.shapeCatalogues).toHaveLength(1);
    expect(model.shapeCatalogues[0].shapes).toHaveLength(24);

    expect(model.diagram).toBeDefined();
    expect(model.diagram?.groups.length).toBeGreaterThan(0);
  });

  it('resolves every URI in the oracle to a known class in SCHEMA', () => {
    const allUris = new Set<string>();

    function collectUris(node: any): void {
      if (!node || typeof node !== 'object') return;
      if (node.uri) allUris.add(node.uri);
      if (node.composition) {
        for (const child of Object.values(node.composition)) {
          if (Array.isArray(child)) child.forEach(collectUris);
          else collectUris(child);
        }
      }
      if (node.data) {
        for (const child of Object.values(node.data)) {
          if (Array.isArray(child)) child.forEach(collectUris);
          else if (child && typeof child === 'object' && child.uri) collectUris(child);
        }
      }
    }

    collectUris(oracleJson);
    expect(allUris.size).toBeGreaterThan(20);

    for (const uri of allUris) {
      const cls = classForUri(uri);
      expect(cls, `URI ${uri} should resolve to a class`).toBeDefined();
      expect(SCHEMA[cls!], `Class ${cls} should exist in SCHEMA`).toBeDefined();
    }
  });

  it('re-serializes back to JSON envelope with structural parity', () => {
    const model = fromEnvelope(oracleJson);
    const reEnvelope = toEnvelope(model);

    expect(reEnvelope.id).toBe(oracleJson.id);
    expect(reEnvelope.uri).toBe(oracleJson.uri);

    // Check composition keys
    expect(Object.keys(reEnvelope.composition || {})).toEqual(
      Object.keys(oracleJson.composition || {})
    );

    const cmOrig = oracleJson.composition?.conceptualModel as DexpiEnvelope;
    const cmRe = reEnvelope.composition?.conceptualModel as DexpiEnvelope;
    expect(cmRe).toBeDefined();

    expect(Object.keys(cmRe.composition || {})).toEqual(
      Object.keys(cmOrig.composition || {})
    );

    // Spot-check counts
    const origPns = cmOrig.composition?.pipingNetworkSystems as DexpiEnvelope[];
    const rePns = cmRe.composition?.pipingNetworkSystems as DexpiEnvelope[];
    expect(rePns).toHaveLength(origPns.length);

    for (let i = 0; i < origPns.length; i++) {
      expect(rePns[i].id).toBe(origPns[i].id);
      expect(rePns[i].uri).toBe(origPns[i].uri);
    }
  });
});


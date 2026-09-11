import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { ProteusReader } from '../src/model/proteus/reader';
import type { Equipment } from '../src/model/classes/equipment';

describe('Proteus XML Reader', () => {
  const c01Path = path.resolve(__dirname, '../samples/dexpi 1.3/example pids/C01 DEXPI Reference P&ID/C01V04-VER.EX01.xml');
  const c01Xml = fs.readFileSync(c01Path, 'utf-8');

  it('parses c01v04-ver.ex01.dexpi with correct object counts and IDs', () => {
    const { model, issues } = ProteusReader.read(c01Xml);

    expect(model).toBeDefined();
    expect(model.conceptualModel).toBeDefined();

    const cm = model.conceptualModel;

    // 1. Tagged plant items (5 equipment)
    expect(cm.taggedPlantItems).toHaveLength(5);
    const equipmentIds = cm.taggedPlantItems.map((e) => e.proteusId);
    expect(equipmentIds).toContain('PlateHeatExchanger-1');
    expect(equipmentIds).toContain('TubularHeatExchanger-1');
    expect(equipmentIds).toContain('CentrifugalPump-1');
    expect(equipmentIds).toContain('ReciprocatingPump-1');
    expect(equipmentIds).toContain('Tank-1');

    // 2. Equipment nozzles
    const pump = cm.taggedPlantItems.find((e) => e.proteusId === 'CentrifugalPump-1') as Equipment;
    expect(pump).toBeDefined();
    expect(pump.dexpiClass).toBe('CentrifugalPump');
    expect(pump.tagName).toBe('P4711');
    expect(pump.nozzles).toHaveLength(2);
    expect(pump.nozzles[0].nodes).toHaveLength(1);

    // 3. Piping systems and segments
    expect(cm.pipingNetworkSystems).toHaveLength(11);
    const totalSegments = cm.pipingNetworkSystems.reduce((sum, s) => sum + s.segments.length, 0);
    expect(totalSegments).toBeGreaterThanOrEqual(11);

    // 4. Instrumentation
    expect(cm.processInstrumentationFunctions).toHaveLength(4);
    expect(cm.instrumentationLoopFunctions).toHaveLength(4);
    expect(cm.actuatingSystems).toHaveLength(3);

    // 5. Shape catalogues and diagrams
    expect(model.shapeCatalogues).toHaveLength(1);
    expect(model.shapeCatalogues[0].shapes).toHaveLength(24);
    expect(model.diagram).toBeDefined();
  });

  it('maps GenericAttributes to typed fields and retains unmatched ones in customAttributes', () => {
    const { model } = ProteusReader.read(c01Xml);
    const meta = model.conceptualModel.metaData;

    expect(meta).toBeDefined();
    expect(meta?.approvalDateRepresentation).toBe('2016-04-01');
    expect(meta?.approverName).toBe('A. P. Prover');
    expect(meta?.drawingNumber).toBe('123/A93');

    // Custom attributes preserved
    expect(meta?.customAttributes).toBeDefined();
    expect(meta?.customAttributes?.length).toBeGreaterThan(0);
  });

  it('correctly resolves segment connections and endpoints', () => {
    const { model } = ProteusReader.read(c01Xml);
    const pnsList = model.conceptualModel.pipingNetworkSystems;

    let segmentWithEndpoints = 0;
    for (const pns of pnsList) {
      for (const seg of pns.segments) {
        if (seg.sourceItem && seg.targetItem) {
          segmentWithEndpoints++;
          // Both endpoints should be valid UUIDs
          expect(seg.sourceItem).toMatch(/^[0-9a-f-]+$/i);
          expect(seg.targetItem).toMatch(/^[0-9a-f-]+$/i);
        }
      }
    }

    expect(segmentWithEndpoints).toBeGreaterThan(0);
  });

  it('parses re-authored simple-pid.dexpi correctly', () => {
    const simplePath = path.resolve(__dirname, '../samples/simple-pid.dexpi');
    const simpleXml = fs.readFileSync(simplePath, 'utf-8');
    const { model } = ProteusReader.read(simpleXml);

    expect(model.conceptualModel.taggedPlantItems).toHaveLength(3);
    const tagNames = model.conceptualModel.taggedPlantItems.map((e) => e.tagName);
    expect(tagNames).toContain('TK-101');
    expect(tagNames).toContain('P-101A');
    expect(tagNames).toContain('HEX-101');

    expect(model.conceptualModel.pipingNetworkSystems).toHaveLength(1);
    expect(model.conceptualModel.pipingNetworkSystems[0].segments).toHaveLength(2);
    expect(model.conceptualModel.processInstrumentationFunctions).toHaveLength(1);
  });
});

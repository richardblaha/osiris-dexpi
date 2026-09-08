import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { ProteusReader, ProteusWriter, DexpiValidator, DexpiModelService } from '../src/model';

describe('Proteus DEXPI SerDes & Validator', () => {
  const sampleXmlPath = path.resolve(__dirname, '../samples/simple-pid.dexpi');
  const sampleXml = fs.readFileSync(sampleXmlPath, 'utf-8');

  it('deserializes sample DEXPI Proteus XML accurately', () => {
    const { model } = ProteusReader.read(sampleXml);
    const service = new DexpiModelService(model);
    const structure = service.getStructure();

    expect(structure.plantModel.equipmentCount).toBe(3);
    expect(structure.plantModel.pipingSegmentsCount).toBe(2);
    expect(structure.plantModel.instrumentsCount).toBe(1);

    const tank = structure.equipment.find((e) => e.tagName === 'TK-101');
    expect(tank).toBeDefined();
    expect(tank?.componentClass).toBe('StorageTank');

    const pump = structure.equipment.find((e) => e.tagName === 'P-101A');
    expect(pump).toBeDefined();
    expect(pump?.componentClass).toBe('CentrifugalPump');

    const valve = structure.pipingSystems[0].segments[0].valves.find((v) => v.tagName === 'V-101');
    expect(valve).toBeDefined();
  });

  it('performs lossless round-trip serialization', () => {
    const { model: model1 } = ProteusReader.read(sampleXml);
    const serializedXml = ProteusWriter.write(model1);
    const { model: model2 } = ProteusReader.read(serializedXml);

    const s1 = new DexpiModelService(model1).getStructure();
    const s2 = new DexpiModelService(model2).getStructure();

    expect(s2.plantModel.equipmentCount).toBe(s1.plantModel.equipmentCount);
    expect(s2.plantModel.pipingSegmentsCount).toBe(s1.plantModel.pipingSegmentsCount);
    expect(s2.plantModel.instrumentsCount).toBe(s1.plantModel.instrumentsCount);
    expect(s2.equipment.map((e) => e.tagName).sort()).toEqual(s1.equipment.map((e) => e.tagName).sort());
  });

  it('validates a correct DEXPI model without errors', () => {
    const { model } = ProteusReader.read(sampleXml);
    const validator = new DexpiValidator();
    const report = validator.validate(model);

    expect(report.isValid).toBe(true);
    expect(report.summary.errorsCount).toBe(0);
    expect(report.summary.equipmentCount).toBe(3);
    expect(report.summary.pipingSegmentsCount).toBe(2);
  });

  it('detects topological and schema errors in broken models', () => {
    const { model } = ProteusReader.read(sampleXml);
    const validator = new DexpiValidator();

    // Duplicate tagged plant item ID
    const first = model.conceptualModel.taggedPlantItems[0];
    model.conceptualModel.taggedPlantItems.push({
      ...first,
      id: 'TK-101',
      proteusId: 'TK-101',
    } as any);

    const report = validator.validate(model);
    expect(report.isValid).toBe(false);
    expect(report.summary.errorsCount).toBeGreaterThan(0);
    expect(report.issues.some((i) => i.code === 'ERR_DUPLICATE_ID')).toBe(true);
  });
});


import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { ProteusReader } from '../src/model/proteus/reader';
import { DexpiValidator } from '../src/model/validator';
import { make } from '../src/model/factory';
import type { Equipment } from '../src/model/classes/equipment';

describe('DexpiValidator', () => {
  const validator = new DexpiValidator();

  const c01Path = path.resolve(__dirname, '../samples/dexpi 1.3/example pids/C01 DEXPI Reference P&ID/C01V04-VER.EX01.xml');
  const c01Xml = fs.readFileSync(c01Path, 'utf-8');

  const simplePath = path.resolve(__dirname, '../samples/simple-pid.dexpi');
  const simpleXml = fs.readFileSync(simplePath, 'utf-8');

  it('validates c01 model with zero errors', () => {
    const { model } = ProteusReader.read(c01Xml);
    const report = validator.validate(model);

    expect(report.isValid).toBe(true);
    expect(report.summary.errorsCount).toBe(0);
    expect(report.summary.equipmentCount).toBe(5);
    expect(report.summary.pipingSegmentsCount).toBeGreaterThanOrEqual(11);
  });

  it('validates simple-pid model with zero errors', () => {
    const { model } = ProteusReader.read(simpleXml);
    const report = validator.validate(model);

    expect(report.isValid).toBe(true);
    expect(report.summary.errorsCount).toBe(0);
    expect(report.summary.equipmentCount).toBe(3);
  });

  it('detects duplicate element IDs', () => {
    const { model } = ProteusReader.read(simpleXml);
    // Introduce duplicate equipment ID
    const dup = make<Equipment>('StorageTank', {
      id: 'TK-101',
      proteusId: 'TK-101',
      tagName: 'TK-101-DUP',
    });
    model.conceptualModel.taggedPlantItems.push(dup);

    const report = validator.validate(model);
    expect(report.isValid).toBe(false);
    expect(report.summary.errorsCount).toBeGreaterThan(0);
    const dupIssue = report.issues.find((i) => i.code === 'ERR_DUPLICATE_ID');
    expect(dupIssue).toBeDefined();
    expect(dupIssue?.elementId).toBe('TK-101');
  });

  it('detects dangling piping connection endpoints', () => {
    const { model } = ProteusReader.read(simpleXml);
    // Break a segment source
    const seg = model.conceptualModel.pipingNetworkSystems[0].segments[0];
    seg.sourceItem = 'NON-EXISTENT-ID';

    const report = validator.validate(model);
    expect(report.isValid).toBe(false);
    const brokenIssue = report.issues.find((i) => i.code === 'ERR_BROKEN_CONNECTION_FROM');
    expect(brokenIssue).toBeDefined();
    expect(brokenIssue?.message).toContain('NON-EXISTENT-ID');
  });
});


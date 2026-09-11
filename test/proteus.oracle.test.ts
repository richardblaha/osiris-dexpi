import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { ProteusReader } from '../src/model/proteus/reader';
import { fromEnvelope } from '../src/model/envelope';

describe('Proteus Reader vs pyDEXPI Oracle Parity', () => {
  const c01Path = path.resolve(__dirname, '../samples/dexpi 1.3/example pids/C01 DEXPI Reference P&ID/C01V04-VER.EX01.xml');
  const oraclePath = path.resolve(__dirname, '../samples/reference/c01.pydexpi.json');

  const c01Xml = fs.readFileSync(c01Path, 'utf-8');
  const oracleJson = JSON.parse(fs.readFileSync(oraclePath, 'utf-8'));

  const { model: tsModel } = ProteusReader.read(c01Xml);
  const oracleModel = fromEnvelope(oracleJson);

  it('matches equipment count, proteusIds, and class names', () => {
    const tsEq = tsModel.conceptualModel.taggedPlantItems;
    const oracleEq = oracleModel.conceptualModel.taggedPlantItems;

    expect(tsEq).toHaveLength(oracleEq.length);

    const tsTagNames = tsEq.map((e) => e.tagName).sort();
    const oracleTagNames = oracleEq.map((e) => (e as any).tagName).sort();
    expect(tsTagNames).toEqual(oracleTagNames);

    const tsClasses = tsEq.map((e) => e.dexpiClass).sort();
    const oracleClasses = oracleEq.map((e) => e.dexpiClass).sort();
    expect(tsClasses).toEqual(oracleClasses);
  });

  it('matches piping network systems and segment counts', () => {
    const tsPns = tsModel.conceptualModel.pipingNetworkSystems;
    const oraclePns = oracleModel.conceptualModel.pipingNetworkSystems;

    expect(tsPns).toHaveLength(oraclePns.length);

    const tsTotalSegments = tsPns.reduce((sum, s) => sum + s.segments.length, 0);
    const oracleTotalSegments = oraclePns.reduce((sum, s) => sum + s.segments.length, 0);
    expect(tsTotalSegments).toBe(oracleTotalSegments);
  });

  it('matches instrumentation functions, loops, and actuators', () => {
    const tsCm = tsModel.conceptualModel;
    const oracleCm = oracleModel.conceptualModel;

    expect(tsCm.processInstrumentationFunctions).toHaveLength(
      oracleCm.processInstrumentationFunctions.length
    );
    expect(tsCm.instrumentationLoopFunctions).toHaveLength(
      oracleCm.instrumentationLoopFunctions.length
    );
    expect(tsCm.actuatingSystems).toHaveLength(oracleCm.actuatingSystems.length);
  });

  it('matches shape catalogues and shapes count', () => {
    expect(tsModel.shapeCatalogues).toHaveLength(oracleModel.shapeCatalogues.length);
    expect(tsModel.shapeCatalogues[0].shapes).toHaveLength(
      oracleModel.shapeCatalogues[0].shapes.length
    );
  });
});

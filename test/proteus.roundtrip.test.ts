import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { ProteusReader } from '../src/model/proteus/reader';
import { ProteusWriter } from '../src/model/proteus/writer';

describe('Proteus XML Roundtrip (Writer & Reader)', () => {
  const simplePath = path.resolve(__dirname, '../samples/simple-pid.dexpi');
  const simpleXml = fs.readFileSync(simplePath, 'utf-8');

  const c01Path = path.resolve(__dirname, '../samples/c01v04-ver.ex01.dexpi');
  const c01Xml = fs.readFileSync(c01Path, 'utf-8');

  it('serializes simple-pid.dexpi and re-reads with full parity', () => {
    const { model: m1 } = ProteusReader.read(simpleXml);
    const writtenXml1 = ProteusWriter.write(m1);

    expect(writtenXml1).toContain('<PlantModel');
    expect(writtenXml1).toContain('<PlantInformation');
    expect(writtenXml1).toContain('<Equipment ID="TK-101"');
    expect(writtenXml1).toContain('<Equipment ID="P-101A"');
    expect(writtenXml1).toContain('<Equipment ID="HEX-101"');
    expect(writtenXml1).toContain('<PipingNetworkSystem ID="PNS-001"');
    expect(writtenXml1).toContain('<ProcessInstrumentationFunction ID="PIF-001"');

    const { model: m2 } = ProteusReader.read(writtenXml1);

    expect(m2.conceptualModel.taggedPlantItems).toHaveLength(m1.conceptualModel.taggedPlantItems.length);
    expect(m2.conceptualModel.pipingNetworkSystems).toHaveLength(m1.conceptualModel.pipingNetworkSystems.length);
    expect(m2.conceptualModel.processInstrumentationFunctions).toHaveLength(
      m1.conceptualModel.processInstrumentationFunctions.length
    );
  });

  it('satisfies idempotence: write(read(write(read(xml)))) === write(read(xml)) for simple-pid', () => {
    const { model: m1 } = ProteusReader.read(simpleXml);
    const xml1 = ProteusWriter.write(m1);

    const { model: m2 } = ProteusReader.read(xml1);
    const xml2 = ProteusWriter.write(m2);

    expect(xml2.trim()).toBe(xml1.trim());
  });

  it('satisfies idempotence for c01v04-ver.ex01.dexpi', () => {
    const { model: m1 } = ProteusReader.read(c01Xml);
    const xml1 = ProteusWriter.write(m1);

    const { model: m2 } = ProteusReader.read(xml1);
    const xml2 = ProteusWriter.write(m2);

    expect(xml2.trim()).toBe(xml1.trim());
  });

  it('can be parsed by pyDEXPI reference loader', () => {
    const { execSync } = require('child_process');
    const { model } = ProteusReader.read(simpleXml);
    const writtenXml = ProteusWriter.write(model);

    const tmpPath = path.resolve(__dirname, '../samples/reference/temp_roundtrip.dexpi');
    fs.writeFileSync(tmpPath, writtenXml);

    try {
      const result = execSync(
        `.venv/bin/python -c "
from pydexpi.loaders.proteus_serializer import ProteusSerializer
from pathlib import Path
serializer = ProteusSerializer()
m = serializer.proteus_loader.load_xml_file(Path('${tmpPath}'))
print(len(m.conceptualModel.taggedPlantItems))
"`,
        { encoding: 'utf-8' }
      );
      expect(result.trim()).toBe('3');
    } finally {
      if (fs.existsSync(tmpPath)) {
        fs.unlinkSync(tmpPath);
      }
    }
  });
});

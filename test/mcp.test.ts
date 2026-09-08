import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { McpToolHandler } from '../src/mcp/tools';

describe('MCP Tools (Standalone File Mode)', () => {
  const sampleXmlPath = path.resolve(__dirname, '../samples/simple-pid.dexpi');
  const tempXmlPath = path.join(os.tmpdir(), 'osiris-dexpi-temp-test-pid.dexpi');
  let handler: McpToolHandler;

  beforeEach(() => {
    // Copy sample to temp test file
    fs.copyFileSync(sampleXmlPath, tempXmlPath);
    handler = new McpToolHandler(59999); // unused port to ensure standalone mode
  });

  afterEach(() => {
    if (fs.existsSync(tempXmlPath)) {
      fs.unlinkSync(tempXmlPath);
    }
  });

  it('get_pid_structure returns summary of equipment, piping, and instruments', async () => {
    const structure = await handler.getPidStructure({ filePath: tempXmlPath });

    expect(structure.source).toBe('file');
    expect(structure.plantModel.equipmentCount).toBe(3);
    expect(structure.equipment.map((e) => e.id)).toContain('TK-101');
    expect(structure.equipment.map((e) => e.id)).toContain('P-101A');
    expect(structure.equipment.map((e) => e.id)).toContain('HEX-101');

    expect(structure.pipingSystems).toHaveLength(1);
    expect(structure.pipingSystems[0].segments).toHaveLength(2);

    expect(structure.instrumentation).toHaveLength(1);
    expect(structure.instrumentation[0].instruments[0].tagName).toBe('FT-101');
  });

  it('add_equipment inserts a new equipment node into the XML file', async () => {
    const result = await handler.addEquipment({
      filePath: tempXmlPath,
      id: 'P-101B',
      tagName: 'P-101B',
      componentClass: 'CentrifugalPump',
      componentName: 'Standby Feed Pump B',
      x: 340,
      y: 500,
      width: 70,
      height: 70,
      attributes: {
        Power: '7.5',
        Fluid: 'RawWater',
      },
    });

    expect(result.success).toBe(true);
    expect(result.equipmentId).toBe('P-101B');

    // Verify persisted in XML
    const structure = await handler.getPidStructure({ filePath: tempXmlPath });
    expect(structure.plantModel.equipmentCount).toBe(4);

    const added = structure.equipment.find((e) => e.id === 'P-101B');
    expect(added).toBeDefined();
    expect(added?.tagName).toBe('P-101B');
    expect(added?.position).toEqual({ x: 340, y: 500 });
    expect(added?.attributes['Power']).toBe('7.5');
  });

  it('connect_piping connects equipment with a new piping segment', async () => {
    // Add equipment first
    await handler.addEquipment({
      filePath: tempXmlPath,
      id: 'P-101B',
      tagName: 'P-101B',
      componentClass: 'CentrifugalPump',
      x: 340,
      y: 500,
    });

    // Connect tank to pump B
    const connectResult = await handler.connectPiping({
      filePath: tempXmlPath,
      fromId: 'TK-101-N1',
      toId: 'P-101B-N1',
      segmentId: 'SEG-003',
      fluidCode: 'RAW',
      nominalDiameter: 'DN80',
    });

    expect(connectResult.success).toBe(true);
    expect(connectResult.segmentId).toBe('SEG-003');

    const structure = await handler.getPidStructure({ filePath: tempXmlPath });
    const seg3 = structure.pipingSystems[0].segments.find((s) => s.id === 'SEG-003');
    expect(seg3).toBeDefined();
    expect(seg3?.connections[0]).toEqual({ fromId: 'TK-101-N1', toId: 'P-101B-N1' });
  });

  it('update_attributes modifies process parameters in the XML model', async () => {
    const updateResult = await handler.updateAttributes({
      filePath: tempXmlPath,
      elementId: 'TK-101',
      tagName: 'TK-101-MODIFIED',
      attributes: {
        Volume: '75',
        DesignPressure: '1.0',
      },
    });

    expect(updateResult.success).toBe(true);
    expect(updateResult.elementId).toBe('TK-101');

    const structure = await handler.getPidStructure({ filePath: tempXmlPath });
    const tank = structure.equipment.find((e) => e.id === 'TK-101');
    expect(tank?.tagName).toBe('TK-101-MODIFIED');
    expect(tank?.attributes['Volume']).toBe('75');
    expect(parseFloat(tank?.attributes['DesignPressure'] || '0')).toBe(1.0);
  });

  it('validate_dexpi runs topological and schema validation', async () => {
    const report = await handler.validateDexpi({ filePath: tempXmlPath });
    expect(report.isValid).toBe(true);
    expect(report.summary.errorsCount).toBe(0);
  });
});


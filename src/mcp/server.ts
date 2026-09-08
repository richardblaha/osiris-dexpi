import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { McpToolHandler } from './tools';

export function createMcpServer(ipcPort: number = 45123): McpServer {
  const server = new McpServer({
    name: 'osiris-dexpi-mcp',
    version: '0.1.0',
  });

  const handler = new McpToolHandler(ipcPort);

  // Tool 1: get_pid_structure
  server.tool(
    'get_pid_structure',
    'Returns a complete JSON summary of equipment, piping lines, and instruments in the open P&ID diagram.',
    {
      filePath: z.string().optional().describe('Path to the .dexpi file. If omitted, queries the active document in VS Code.'),
    },
    async (args) => {
      try {
        const result = await handler.getPidStructure(args);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Error getting P&ID structure: ${err.message}` }],
        };
      }
    }
  );

  // Tool 2: add_equipment
  server.tool(
    'add_equipment',
    'Inserts a new equipment node (pump, tank, vessel, heat exchanger) with DEXPI-compliant coordinates and metadata.',
    {
      id: z.string().describe('Unique identifier for the equipment (e.g. "P-102", "TK-102")'),
      tagName: z.string().describe('Display tag name (e.g. "P-102A")'),
      componentClass: z.string().describe('DEXPI ComponentClass (CentrifugalPump, StorageTank, VerticalVessel, PlateHeatExchanger, ShellAndTubeHeatExchanger)'),
      componentName: z.string().optional().describe('Descriptive name (e.g. "Boiler Feed Pump")'),
      x: z.number().describe('X coordinate on canvas in mm/pixels'),
      y: z.number().describe('Y coordinate on canvas in mm/pixels'),
      width: z.number().optional().describe('Width of the symbol in px'),
      height: z.number().optional().describe('Height of the symbol in px'),
      attributes: z.record(z.string()).optional().describe('Key-value process attributes (e.g. DesignPressure: "16", Fluid: "Water")'),
      filePath: z.string().optional().describe('Path to target file. If omitted, applies to the active VS Code buffer.'),
    },
    async (args) => {
      try {
        const result = await handler.addEquipment(args);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Error adding equipment: ${err.message}` }],
        };
      }
    }
  );

  // Tool 3: connect_piping
  server.tool(
    'connect_piping',
    'Connects two equipment nodes or nozzles via a process pipeline or instrument line.',
    {
      fromId: z.string().describe('Source element or nozzle ID'),
      toId: z.string().describe('Target element or nozzle ID'),
      segmentId: z.string().optional().describe('Unique ID for the piping segment'),
      fluidCode: z.string().optional().describe('Fluid service code (e.g. "CW", "RAW", "STEAM", "AIR")'),
      nominalDiameter: z.string().optional().describe('Pipe size (e.g. "DN50", "DN100", "2in")'),
      systemTagName: z.string().optional().describe('Tag name for the piping system'),
      valve: z
        .object({
          id: z.string(),
          tagName: z.string(),
          componentClass: z.string(),
        })
        .optional()
        .describe('Optional inline valve to place along the line'),
      filePath: z.string().optional().describe('Path to target file. If omitted, applies to active VS Code buffer.'),
    },
    async (args) => {
      try {
        const result = await handler.connectPiping(args);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Error connecting piping: ${err.message}` }],
        };
      }
    }
  );

  // Tool 4: update_attributes
  server.tool(
    'update_attributes',
    'Updates engineering parameters, process variables, or tag names for an element in the diagram.',
    {
      elementId: z.string().describe('ID of the equipment, valve, or instrument to modify'),
      tagName: z.string().optional().describe('Updated tag name'),
      attributes: z.record(z.string()).optional().describe('Dictionary of attributes to set/update'),
      filePath: z.string().optional().describe('Path to target file. If omitted, applies to active VS Code buffer.'),
    },
    async (args) => {
      try {
        const result = await handler.updateAttributes(args);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Error updating attributes: ${err.message}` }],
        };
      }
    }
  );

  // Tool 5: validate_dexpi
  server.tool(
    'validate_dexpi',
    'Runs complete DEXPI schema conformance and topological connectivity checks on the P&ID diagram.',
    {
      filePath: z.string().optional().describe('Path to target file. If omitted, validates the active VS Code buffer.'),
    },
    async (args) => {
      try {
        const result = await handler.validateDexpi(args);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Error validating diagram: ${err.message}` }],
        };
      }
    }
  );

  return server;
}


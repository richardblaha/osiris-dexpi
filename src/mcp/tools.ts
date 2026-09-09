/**
 * Model Context Protocol (MCP) tool handlers for OSIRIS DEXPI.
 * Delegates all domain mutations and queries to DexpiModelService.
 */

import * as fs from 'fs';
import { DexpiModelService, PidStructureResult } from '../model/service';
import { McpIpcClient } from './ipcClient';
import { ValidationReport } from '../common/types';

export { PidStructureResult };

export class McpToolHandler {
  private ipcClient: McpIpcClient;

  constructor(ipcPort: number = 45123) {
    this.ipcClient = new McpIpcClient(ipcPort);
  }

  /**
   * Tool 1: get_pid_structure
   */
  public async getPidStructure(params: { filePath?: string }): Promise<PidStructureResult> {
    const { service, source, uri } = await this.getService(params.filePath);
    return service.getStructure(source, uri);
  }

  /**
   * Tool 2: add_equipment
   */
  public async addEquipment(params: {
    filePath?: string;
    id: string;
    tagName: string;
    componentClass: string;
    componentName?: string;
    x: number;
    y: number;
    width?: number;
    height?: number;
    nozzles?: Array<{ id?: string; tagName?: string; connectionType?: string }>;
    attributes?: Record<string, string>;
  }): Promise<{ success: boolean; equipmentId: string; message: string }> {
    const isExtensionActive = await this.ipcClient.isExtensionRunning();
    if (isExtensionActive && !params.filePath) {
      return this.ipcClient.sendRequest('addEquipment', params as any);
    }

    const { service, source, filePath } = await this.getService(params.filePath);
    const result = service.addEquipment(params);
    await this.saveService(service, source, filePath);
    return result;
  }

  /**
   * Tool 3: connect_piping
   */
  public async connectPiping(params: {
    filePath?: string;
    fromId: string;
    toId: string;
    segmentId?: string;
    fluidCode?: string;
    nominalDiameter?: string;
    systemTagName?: string;
    valve?: { id: string; tagName: string; componentClass: string };
  }): Promise<{ success: boolean; segmentId: string; message: string }> {
    const isExtensionActive = await this.ipcClient.isExtensionRunning();
    if (isExtensionActive && !params.filePath) {
      return this.ipcClient.sendRequest('connectPiping', params as any);
    }

    const { service, source, filePath } = await this.getService(params.filePath);
    const result = service.connectPiping(params);
    await this.saveService(service, source, filePath);
    return result;
  }

  /**
   * Tool 4: update_attributes
   */
  public async updateAttributes(params: {
    filePath?: string;
    elementId: string;
    tagName?: string;
    attributes?: Record<string, string>;
  }): Promise<{ success: boolean; elementId: string; updatedProperties: string[] }> {
    const isExtensionActive = await this.ipcClient.isExtensionRunning();
    if (isExtensionActive && !params.filePath) {
      return this.ipcClient.sendRequest('updateAttributes', params as any);
    }

    const { service, source, filePath } = await this.getService(params.filePath);
    const result = service.updateAttributes(params);
    await this.saveService(service, source, filePath);
    return result;
  }

  /**
   * Tool 5: delete_element
   */
  public async deleteElement(params: {
    filePath?: string;
    elementId: string;
  }): Promise<{ success: boolean; elementId: string; deletedType: string; message: string }> {
    const isExtensionActive = await this.ipcClient.isExtensionRunning();
    if (isExtensionActive && !params.filePath) {
      return this.ipcClient.sendRequest('deleteElement', params as any);
    }

    const { service, source, filePath } = await this.getService(params.filePath);
    const result = service.deleteElement(params.elementId);
    await this.saveService(service, source, filePath);
    return result;
  }

  /**
   * Tool 6: reverse_piping_flow
   */
  public async reversePipingFlow(params: {
    filePath?: string;
    segmentId: string;
  }): Promise<{ success: boolean; segmentId: string; newFrom: string; newTo: string; message: string }> {
    const isExtensionActive = await this.ipcClient.isExtensionRunning();
    if (isExtensionActive && !params.filePath) {
      return this.ipcClient.sendRequest('reversePipingFlow', params as any);
    }

    const { service, source, filePath } = await this.getService(params.filePath);
    const result = service.reversePipingFlow(params.segmentId);
    await this.saveService(service, source, filePath);
    return result;
  }

  /**
   * Tool 7: split_piping
   */
  public async splitPiping(params: {
    filePath?: string;
    segmentId: string;
    valve: { id: string; tagName: string; componentClass: string };
    newSegmentId?: string;
  }): Promise<{
    success: boolean;
    originalSegmentId: string;
    newSegmentId: string;
    valveId: string;
    message: string;
  }> {
    const isExtensionActive = await this.ipcClient.isExtensionRunning();
    if (isExtensionActive && !params.filePath) {
      return this.ipcClient.sendRequest('splitPiping', params as any);
    }

    const { service, source, filePath } = await this.getService(params.filePath);
    const result = service.splitPiping(params);
    await this.saveService(service, source, filePath);
    return result;
  }

  /**
   * Tool 8: validate_dexpi
   */
  public async validateDexpi(params: { filePath?: string }): Promise<ValidationReport> {
    const isExtensionActive = await this.ipcClient.isExtensionRunning();
    if (isExtensionActive && !params.filePath) {
      return this.ipcClient.sendRequest('validateDexpi', params as any);
    }

    const { service } = await this.getService(params.filePath);
    return service.validate();
  }

  private async getService(filePath?: string): Promise<{
    service: DexpiModelService;
    source: 'vscode_buffer' | 'file';
    uri?: string;
    filePath?: string;
  }> {
    if (!filePath) {
      try {
        const activeDoc = await this.ipcClient.sendRequest<{
          filePath: string;
          content: string;
        }>('getActivePid');
        const service = DexpiModelService.fromXml(activeDoc.content);
        return {
          service,
          source: 'vscode_buffer',
          uri: activeDoc.filePath,
          filePath: activeDoc.filePath,
        };
      } catch {
        throw new Error('No active DEXPI document in VS Code and no filePath parameter provided');
      }
    }

    if (!fs.existsSync(filePath)) {
      throw new Error(`DEXPI file not found at path: "${filePath}"`);
    }

    const xml = fs.readFileSync(filePath, 'utf-8');
    const service = DexpiModelService.fromXml(xml);
    return {
      service,
      source: 'file',
      uri: filePath,
      filePath,
    };
  }

  private async saveService(
    service: DexpiModelService,
    source: 'vscode_buffer' | 'file',
    filePath?: string
  ): Promise<void> {
    const xml = service.toXml();
    if (source === 'file' && filePath) {
      fs.writeFileSync(filePath, xml, 'utf-8');
    }
  }
}

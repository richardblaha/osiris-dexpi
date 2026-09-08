import * as http from 'http';
import { McpIpcRequest, McpIpcResponse } from '../common/types';

export class McpIpcClient {
  constructor(private readonly port: number = 45123) {}

  public async isExtensionRunning(): Promise<boolean> {
    try {
      await this.sendRequest('getActivePid');
      return true;
    } catch {
      return false;
    }
  }

  public sendRequest<T = any>(
    method: McpIpcRequest['method'],
    params?: Record<string, unknown>
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const payload: McpIpcRequest = {
        id: Math.random().toString(36).substring(2, 9),
        method,
        params,
      };

      const data = JSON.stringify(payload);
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: this.port,
          path: '/mcp-bridge',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data),
          },
          timeout: 2000,
        },
        (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            try {
              const resp = JSON.parse(body) as McpIpcResponse;
              if (resp.success) {
                resolve(resp.data as T);
              } else {
                reject(new Error(resp.error || 'Unknown IPC bridge error'));
              }
            } catch (e) {
              reject(e);
            }
          });
        }
      );

      req.on('error', (err) => {
        reject(err);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Extension IPC request timed out'));
      });

      req.write(data);
      req.end();
    });
  }
}


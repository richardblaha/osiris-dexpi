/**
 * Client Bridge for Web Worker Offload
 *
 * Manages request-response correlation and provides fallback to direct execution
 * when Web Workers are unavailable or in test environments.
 */

import type { RouteRequest, Point2D } from '../routing/orthogonalRouter';
import type { PidView } from '../../model/view/projection';
import type { WorkerInMessage, WorkerOutMessage } from './protocol';
import { handleWorkerMessage } from './dexpiWorker';

export class DexpiWorkerBridge {
  private worker: Worker | null = null;
  private nextMessageId = 1;
  private pendingRequests = new Map<
    number,
    { resolve: (val: any) => void; reject: (err: any) => void }
  >();

  constructor(workerScriptUrl?: string) {
    if (typeof Worker !== 'undefined' && workerScriptUrl) {
      try {
        this.worker = new Worker(workerScriptUrl);
        this.worker.onmessage = this.onMessage;
        this.worker.onerror = this.onError;
      } catch (e) {
        console.warn('[DexpiWorkerBridge] Could not initialize Web Worker, using direct mode:', e);
        this.worker = null;
      }
    }
  }

  /**
   * Dispatches an A* routing request to the background worker.
   */
  public async route(request: RouteRequest): Promise<Point2D[]> {
    const res = await this.sendRequest<WorkerInMessage, any>({
      id: this.nextMessageId++,
      type: 'ROUTE_REQUEST',
      payload: request,
    });
    return res.waypoints;
  }

  /**
   * Offloads spatial index building to the worker with zero-copy Transferable ArrayBuffers.
   */
  public async buildIndex(boxes: Float32Array, ids: Uint32Array): Promise<number> {
    const res = await this.sendRequest<WorkerInMessage, any>(
      {
        id: this.nextMessageId++,
        type: 'BUILD_INDEX_REQUEST',
        payload: {
          boxesBuffer: boxes.buffer,
          idsBuffer: ids.buffer,
        },
      },
      [boxes.buffer, ids.buffer]
    );
    return res.itemCount;
  }

  /**
   * Offloads XML parsing to the background worker.
   */
  public async parseXml(xmlText: string): Promise<PidView> {
    const res = await this.sendRequest<WorkerInMessage, any>({
      id: this.nextMessageId++,
      type: 'PARSE_XML_REQUEST',
      payload: { xmlText },
    });
    return res.view;
  }

  private sendRequest<T extends WorkerInMessage, R>(
    msg: T,
    transferables?: Transferable[]
  ): Promise<R> {
    if (!this.worker) {
      // Synchronous fallback (same logic executed in-memory)
      return new Promise((resolve, reject) => {
        try {
          const response = handleWorkerMessage(msg);
          if (response.type === 'ERROR_RESPONSE') {
            reject(new Error(response.error));
          } else {
            resolve((response as any).payload);
          }
        } catch (err) {
          reject(err);
        }
      });
    }

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(msg.id, { resolve, reject });
      if (transferables && transferables.length > 0) {
        this.worker!.postMessage(msg, transferables);
      } else {
        this.worker!.postMessage(msg);
      }
    });
  }

  private onMessage = (event: MessageEvent<WorkerOutMessage>): void => {
    const msg = event.data;
    const pending = this.pendingRequests.get(msg.id);
    if (!pending) return;

    this.pendingRequests.delete(msg.id);
    if (msg.type === 'ERROR_RESPONSE') {
      pending.reject(new Error(msg.error));
    } else {
      pending.resolve((msg as any).payload);
    }
  };

  private onError = (event: ErrorEvent): void => {
    console.error('[DexpiWorkerBridge] Worker error:', event);
  };

  public terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.pendingRequests.clear();
  }
}


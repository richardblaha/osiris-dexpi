/**
 * DEXPI Web Worker Engine
 *
 * Runs heavy CAD operations (A* routing, XML streaming parsing, and PackedRTree indexing)
 * in a dedicated background worker thread to keep the 60 FPS WebGPU render loop uninterrupted.
 */

import { OrthogonalRouter } from '../routing/orthogonalRouter';
import { PackedRTree } from '../spatial/packedRTree';
import { ProteusReader } from '../../model/proteus/reader';
import { projectToView } from '../../model/view/projection';
import type {
  WorkerInMessage,
  WorkerOutMessage,
  RouteResponseMessage,
  BuildIndexResponseMessage,
  ParseXmlResponseMessage,
  ErrorResponseMessage,
} from './protocol';

const workerSpatialTree = new PackedRTree(16);

/**
 * Message handler executing either in a true Web Worker or within a synchronous test wrapper.
 */
export function handleWorkerMessage(msg: WorkerInMessage): WorkerOutMessage {
  try {
    switch (msg.type) {
      case 'ROUTE_REQUEST': {
        const waypoints = OrthogonalRouter.route(msg.payload);
        const res: RouteResponseMessage = {
          id: msg.id,
          type: 'ROUTE_RESPONSE',
          payload: { waypoints },
        };
        return res;
      }

      case 'BUILD_INDEX_REQUEST': {
        const boxes = new Float32Array(msg.payload.boxesBuffer);
        const ids = new Uint32Array(msg.payload.idsBuffer);
        workerSpatialTree.load(boxes, ids);
        const res: BuildIndexResponseMessage = {
          id: msg.id,
          type: 'BUILD_INDEX_RESPONSE',
          payload: { itemCount: workerSpatialTree.size },
        };
        return res;
      }

      case 'PARSE_XML_REQUEST': {
        const { model } = ProteusReader.read(msg.payload.xmlText);
        const view = projectToView(model);
        const res: ParseXmlResponseMessage = {
          id: msg.id,
          type: 'PARSE_XML_RESPONSE',
          payload: { view },
        };
        return res;
      }

      default: {
        const err: ErrorResponseMessage = {
          id: (msg as any).id || 0,
          type: 'ERROR_RESPONSE',
          error: `Unknown worker message type: ${(msg as any).type}`,
        };
        return err;
      }
    }
  } catch (e: any) {
    const err: ErrorResponseMessage = {
      id: msg.id,
      type: 'ERROR_RESPONSE',
      error: e?.message || String(e),
    };
    return err;
  }
}

// In dedicated worker scope
if (typeof self !== 'undefined' && typeof (self as any).postMessage === 'function' && typeof window === 'undefined') {
  self.onmessage = (event: MessageEvent<WorkerInMessage>) => {
    const result = handleWorkerMessage(event.data);
    (self as any).postMessage(result);
  };
}


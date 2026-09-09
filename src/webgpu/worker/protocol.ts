/**
 * Protocol Definitions for Worker Offload IPC
 *
 * Supports zero-copy message transfers (Transferable ArrayBuffers) between UI thread and Worker.
 */

import type { RouteRequest, Point2D } from '../routing/orthogonalRouter';
import type { PidView } from '../../model/view/projection';

export type WorkerMessageType =
  | 'ROUTE_REQUEST'
  | 'ROUTE_RESPONSE'
  | 'BUILD_INDEX_REQUEST'
  | 'BUILD_INDEX_RESPONSE'
  | 'PARSE_XML_REQUEST'
  | 'PARSE_XML_RESPONSE'
  | 'ERROR_RESPONSE';

export interface BaseWorkerMessage {
  id: number;
  type: WorkerMessageType;
}

export interface RouteRequestMessage extends BaseWorkerMessage {
  type: 'ROUTE_REQUEST';
  payload: RouteRequest;
}

export interface RouteResponseMessage extends BaseWorkerMessage {
  type: 'ROUTE_RESPONSE';
  payload: {
    waypoints: Point2D[];
  };
}

export interface BuildIndexRequestMessage extends BaseWorkerMessage {
  type: 'BUILD_INDEX_REQUEST';
  payload: {
    boxesBuffer: ArrayBuffer;
    idsBuffer: ArrayBuffer;
  };
}

export interface BuildIndexResponseMessage extends BaseWorkerMessage {
  type: 'BUILD_INDEX_RESPONSE';
  payload: {
    itemCount: number;
  };
}

export interface ParseXmlRequestMessage extends BaseWorkerMessage {
  type: 'PARSE_XML_REQUEST';
  payload: {
    xmlText: string;
  };
}

export interface ParseXmlResponseMessage extends BaseWorkerMessage {
  type: 'PARSE_XML_RESPONSE';
  payload: {
    view: PidView;
  };
}

export interface ErrorResponseMessage extends BaseWorkerMessage {
  type: 'ERROR_RESPONSE';
  error: string;
}

export type WorkerInMessage =
  | RouteRequestMessage
  | BuildIndexRequestMessage
  | ParseXmlRequestMessage;

export type WorkerOutMessage =
  | RouteResponseMessage
  | BuildIndexResponseMessage
  | ParseXmlResponseMessage
  | ErrorResponseMessage;


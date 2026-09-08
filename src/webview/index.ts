import type { ExtensionToWebviewMessage } from '../common/types';
import type { PidView } from '../model/view/projection';
import { ThemeManager } from './theme';
import { VisualCanvas } from './canvas';
import { CanvasOverlay, OverlayPosition } from './overlay';

declare function acquireVsCodeApi(): {
  postMessage: (message: unknown) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
};

const vscode = acquireVsCodeApi();

let canvas: VisualCanvas;

interface WebviewState {
  gridVisible?: boolean;
  overlayPosition?: OverlayPosition;
}

function readState(): WebviewState {
  return (vscode.getState() as WebviewState) ?? {};
}

function patchState(patch: WebviewState): void {
  vscode.setState({ ...readState(), ...patch });
}

function initWebview(): void {
  ThemeManager.init();

  const graphContainer = document.getElementById('graph-container');
  if (!graphContainer) return;

  const overlay = new CanvasOverlay(
    document.body,
    {
      onZoomIn: () => canvas.zoomIn(),
      onZoomOut: () => canvas.zoomOut(),
      onZoomReset: () => canvas.zoomReset(),
      onZoomFit: () => canvas.zoomFit(),
      onToggleGrid: () => canvas.toggleGrid(),
    },
    { position: readState().overlayPosition ?? 'top-right' }
  );

  canvas = new VisualCanvas(graphContainer, {
    onModelChanged: (view: PidView) => {
      vscode.postMessage({
        type: 'modelChanged',
        view,
      });
    },
    onSelectionChanged: (selection) => {
      vscode.postMessage({ type: 'selectionChanged', selection });
    },
    onGridChanged: (visible) => {
      patchState({ gridVisible: visible });
      overlay.setGridActive(visible);
    },
    onZoomChanged: (scale) => overlay.setZoom(scale),
  });

  canvas.setGridVisible(readState().gridVisible ?? true);
  overlay.setZoom(canvas.getZoom());

  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      vscode.postMessage({ type: 'save' });
    }
  });

  window.addEventListener('message', (event) => {
    const message = event.data as ExtensionToWebviewMessage | any;
    switch (message.type) {
      case 'init':
      case 'updateModel': {
        const viewOrModel = message.view || message.model;
        if (viewOrModel) {
          canvas.renderModel(viewOrModel);
        }
        break;
      }
      case 'insertSymbol': {
        canvas.insertSymbol(message.item);
        break;
      }
      case 'updateElement': {
        canvas.updateCellAttribute(message.elementId, message.property, message.value);
        break;
      }
      case 'exportSvg': {
        vscode.postMessage({ type: 'svgExported', svg: canvas.exportSvg() });
        break;
      }
    }
  });

  vscode.postMessage({ type: 'ready' });
}

window.addEventListener('DOMContentLoaded', initWebview);

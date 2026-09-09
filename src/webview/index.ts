import type { ExtensionToWebviewMessage } from '../common/types';
import type { PidView } from '../model/view/projection';
import { ThemeManager } from './theme';
import { WebGpuVisualCanvas } from './webgpuCanvas';
import { CanvasOverlay, OverlayPosition } from './overlay';

declare function acquireVsCodeApi(): {
  postMessage: (message: unknown) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
};

const vscode = acquireVsCodeApi();

let canvas: WebGpuVisualCanvas;

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

async function initWebview(): Promise<void> {
  ThemeManager.init();

  const graphContainer = document.getElementById('graph-container');
  if (!graphContainer) return;

  const overlay = new CanvasOverlay(
    document.body,
    {
      onZoomIn: () => canvas?.zoomIn(),
      onZoomOut: () => canvas?.zoomOut(),
      onZoomReset: () => canvas?.zoomReset(),
      onZoomFit: () => canvas?.zoomFit(),
      onToggleGrid: () => canvas?.toggleGrid(),
      onUndo: () => canvas?.undo(),
      onRedo: () => canvas?.redo(),
      onRotate: () => canvas?.rotateSelected(),
      onMirror: () => canvas?.mirrorSelected(),
      onReverseFlow: () => canvas?.reverseFlowSelected(),
      onToggleLineMode: () => {
        const next = canvas?.toggleLineMode();
        if (next) overlay.setLineMode(next);
      },
      onDelete: () => canvas?.deleteSelected(),
    },
    { position: readState().overlayPosition ?? 'top-right' }
  );

  const callbacks = {
    onModelChanged: (view: PidView) => {
      vscode.postMessage({
        type: 'modelChanged',
        view,
      });
    },
    onSelectionChanged: (selection: any) => {
      vscode.postMessage({ type: 'selectionChanged', selection });
    },
    onGridChanged: (visible: boolean) => {
      patchState({ gridVisible: visible });
      overlay.setGridActive(visible);
    },
    onZoomChanged: (scale: number) => overlay.setZoom(scale),
  };

  canvas = new WebGpuVisualCanvas(graphContainer, callbacks);
  try {
    await canvas.init();
    console.log('[Osiris] High-performance WebGPU P&ID Engine initialized successfully.');
  } catch (err) {
    console.error('[Osiris] WebGPU initialization failed:', err);
  }

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

window.addEventListener('DOMContentLoaded', () => {
  void initWebview();
});

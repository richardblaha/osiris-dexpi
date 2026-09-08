export type OverlayPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';

export interface CanvasOverlayConfig {
  /** Corner the panel docks to. @default 'top-right' */
  position?: OverlayPosition;
  /** Render the zoom in / out / indicator group. @default true */
  showZoom?: boolean;
  /** Render the grid on/off toggle. @default true */
  showGrid?: boolean;
}

export interface CanvasOverlayHandlers {
  onZoomIn(): void;
  onZoomOut(): void;
  /** Plain click on the percentage — reset to 100 %. */
  onZoomReset(): void;
  /** Double click on the percentage — fit the diagram to the viewport. */
  onZoomFit(): void;
  onToggleGrid(): void;
}

const POSITION_CLASS: Record<OverlayPosition, string> = {
  'top-right': 'canvas-overlay--top-right',
  'top-left': 'canvas-overlay--top-left',
  'bottom-right': 'canvas-overlay--bottom-right',
  'bottom-left': 'canvas-overlay--bottom-left',
};

const GRID_ICON =
  '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">' +
  '<path fill="none" stroke="currentColor" stroke-width="1" ' +
  'd="M1 5.5h14M1 10.5h14M5.5 1v14M10.5 1v14M1 1h14v14H1z"/></svg>';

/**
 * Modular control overlay floating above the canvas. The container itself is
 * `pointer-events: none` so it never steals pans / drags on empty canvas; only
 * the individual controls opt back in.
 */
export class CanvasOverlay {
  public readonly element: HTMLDivElement;
  private readonly zoomLabel?: HTMLButtonElement;
  private readonly gridButton?: HTMLButtonElement;

  constructor(
    parent: HTMLElement,
    handlers: CanvasOverlayHandlers,
    config: CanvasOverlayConfig = {}
  ) {
    const { position = 'top-right', showZoom = true, showGrid = true } = config;

    this.element = document.createElement('div');
    this.element.className = `canvas-overlay ${POSITION_CLASS[position]}`;

    if (showZoom) {
      const group = document.createElement('div');
      group.className = 'canvas-overlay__group';

      const out = makeButton('−', 'Zoom out', () => handlers.onZoomOut());
      const label = document.createElement('button');
      label.type = 'button';
      label.className = 'canvas-overlay__zoom';
      label.textContent = '100%';
      label.title = 'Click: reset to 100% · Double-click: fit to view';
      label.addEventListener('click', () => handlers.onZoomReset());
      label.addEventListener('dblclick', (e) => {
        e.preventDefault();
        handlers.onZoomFit();
      });
      const inb = makeButton('+', 'Zoom in', () => handlers.onZoomIn());

      group.append(out, label, inb);
      this.element.append(group);
      this.zoomLabel = label;
    }

    if (showGrid) {
      const group = document.createElement('div');
      group.className = 'canvas-overlay__group';
      const grid = document.createElement('button');
      grid.type = 'button';
      grid.className = 'canvas-overlay__btn canvas-overlay__grid';
      grid.innerHTML = GRID_ICON;
      grid.title = 'Toggle grid (G)';
      grid.setAttribute('aria-label', 'Toggle grid');
      grid.setAttribute('aria-pressed', 'true');
      grid.addEventListener('click', () => handlers.onToggleGrid());
      group.append(grid);
      this.element.append(group);
      this.gridButton = grid;
    }

    parent.append(this.element);
  }

  /** Reflects the live view scale (1 = 100 %). */
  public setZoom(scale: number): void {
    if (this.zoomLabel) this.zoomLabel.textContent = `${Math.round(scale * 100)}%`;
  }

  public setGridActive(active: boolean): void {
    if (!this.gridButton) return;
    this.gridButton.setAttribute('aria-pressed', String(active));
    this.gridButton.classList.toggle('is-off', !active);
    this.gridButton.title = active ? 'Hide grid (G)' : 'Show grid (G)';
  }

  public dispose(): void {
    this.element.remove();
  }
}

function makeButton(glyph: string, label: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'canvas-overlay__btn';
  button.textContent = glyph;
  button.title = label;
  button.setAttribute('aria-label', label);
  button.addEventListener('click', onClick);
  return button;
}

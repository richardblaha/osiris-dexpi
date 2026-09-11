/**
 * Live SVG rendering of the actual diagram content (equipment/instrument/valve
 * stencils, piping polylines, nozzles, tag/line labels) drawn directly on top of
 * the WebGPU canvas.
 *
 * The WebGPU engine (`src/webgpu/`) only resolves nodes to one of 7 hardcoded
 * placeholder primitives and never rasterizes real stencil geometry or text
 * (its glyph atlas is never populated) — see `renderPidViewDiagramMarkup` in
 * `exportSvg.ts`, which already produces correct output (verified by the SVG
 * export feature) using the real drawio stencil catalog. This layer reuses that
 * exact same markup so the live canvas matches the exported diagram, instead of
 * re-implementing shape/text rendering in WebGPU.
 */

import type { PidView } from '../model/view/projection';
import type { CameraState } from '../webgpu/types';
import { renderPidViewDiagramMarkup } from './exportSvg';

const SVG_NS = 'http://www.w3.org/2000/svg';

export class DiagramSvgLayer {
  private readonly svg: SVGSVGElement;

  constructor(parent: HTMLElement) {
    this.svg = document.createElementNS(SVG_NS, 'svg');
    this.svg.setAttribute('width', '100%');
    this.svg.setAttribute('height', '100%');
    this.svg.classList.add('diagram-content-layer');
    this.svg.style.position = 'absolute';
    this.svg.style.inset = '0';
    // Purely visual: all hit-testing stays analytical against the PidView in
    // WebGpuVisualCanvas, so this layer must never intercept pointer events.
    this.svg.style.pointerEvents = 'none';
    parent.appendChild(this.svg);
  }

  /** Full content rebuild — call whenever the PidView itself changes. */
  public render(view: PidView, camera: CameraState): void {
    this.svg.innerHTML = renderPidViewDiagramMarkup(view, {
      theme: 'dark',
      includeFlowArrows: false, // the interaction overlay already draws flow arrows
    });
    this.setViewBox(camera);
  }

  /** Cheap viewBox-only sync — call on every pan/zoom/resize. */
  public setViewBox(camera: CameraState): void {
    const { x, y, zoom, viewportWidth, viewportHeight } = camera;
    const w = viewportWidth / zoom;
    const h = viewportHeight / zoom;
    const minX = x - w / 2;
    const minY = y - h / 2;
    this.svg.setAttribute('viewBox', `${minX} ${minY} ${w} ${h}`);
  }

  public dispose(): void {
    if (this.svg.parentElement) {
      this.svg.parentElement.removeChild(this.svg);
    }
  }
}

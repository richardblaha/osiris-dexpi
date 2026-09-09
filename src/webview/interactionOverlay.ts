/**
 * Interactive SVG/DOM Overlay for WebGPU P&ID Canvas
 *
 * Implements the upper interactive layer:
 * - Selection Bounding Box & Transform Gizmo
 * - Magnetic Connection Ports (Nozzles)
 * - Live Orthogonal Routing Preview during pipeline creation
 * - Inline Tag Editor on double click
 */

import type { CameraState } from '../webgpu/types';
import type { PidViewNode, PidViewEdge } from '../model/view/projection';
import type { Point2D } from '../webgpu/routing/orthogonalRouter';

export interface OverlayCallbacks {
  onNodeMoved?: (nodeId: string, newX: number, newY: number) => void;
  onPortClick?: (nodeId: string, portIndex: number, portPos: Point2D) => void;
  onTextEdited?: (elementId: string, newText: string) => void;
}

export class InteractionOverlay {
  private container: HTMLElement;
  private svgLayer: SVGSVGElement;
  private textEditorInput: HTMLInputElement | null = null;

  private selectedNodes: PidViewNode[] = [];
  private selectedEdge: PidViewEdge | null = null;
  private hoveredPorts: Array<{ nodeId: string; portIndex: number; worldX: number; worldY: number }> = [];

  // Routing preview state
  private routePreviewPoints: Point2D[] | null = null;

  // Marquee selection state
  private marqueeRect: { x1: number; y1: number; x2: number; y2: number } | null = null;

  // Flow direction arrows
  private flowArrows: Array<{ x: number; y: number; angleRad: number }> = [];

  // Validation issue markers
  private validationIssues: Array<{ x: number; y: number; message: string; severity: 'error' | 'warning' }> = [];

  constructor(
    parent: HTMLElement,
    private readonly callbacks: OverlayCallbacks
  ) {
    this.container = document.createElement('div');
    this.container.className = 'interaction-overlay';
    this.container.style.position = 'absolute';
    this.container.style.inset = '0';
    this.container.style.pointerEvents = 'none';
    this.container.style.overflow = 'hidden';

    this.svgLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svgLayer.setAttribute('width', '100%');
    this.svgLayer.setAttribute('height', '100%');
    this.svgLayer.style.position = 'absolute';
    this.svgLayer.style.inset = '0';
    this.svgLayer.style.pointerEvents = 'none';

    this.container.appendChild(this.svgLayer);
    parent.appendChild(this.container);
  }

  public setSelectedNode(node: PidViewNode | null): void {
    this.selectedNodes = node ? [node] : [];
    this.selectedEdge = null;
  }

  public setSelectedNodes(nodes: PidViewNode[]): void {
    this.selectedNodes = nodes;
    this.selectedEdge = null;
  }

  public setSelectedEdge(edge: PidViewEdge | null): void {
    this.selectedEdge = edge;
    this.selectedNodes = [];
  }

  public setHoveredPorts(ports: Array<{ nodeId: string; portIndex: number; worldX: number; worldY: number }>): void {
    this.hoveredPorts = ports;
  }

  public setRoutePreview(points: Point2D[] | null): void {
    this.routePreviewPoints = points;
  }

  public setMarqueeRect(rect: { x1: number; y1: number; x2: number; y2: number } | null): void {
    this.marqueeRect = rect;
  }

  public setFlowArrows(arrows: Array<{ x: number; y: number; angleRad: number }>): void {
    this.flowArrows = arrows;
  }

  public setValidationIssues(issues: Array<{ x: number; y: number; message: string; severity: 'error' | 'warning' }>): void {
    this.validationIssues = issues;
  }

  /**
   * Refreshes all interactive SVG overlay elements according to current camera state.
   */
  public update(camera: CameraState): void {
    this.svgLayer.innerHTML = '';

    // 0. Flow Direction Arrows
    for (const arrow of this.flowArrows) {
      const sp = this.worldToScreen(arrow.x, arrow.y, camera);
      const size = 6;
      const cos = Math.cos(arrow.angleRad);
      const sin = Math.sin(arrow.angleRad);

      const tipX = sp.x + cos * size;
      const tipY = sp.y + sin * size;
      const leftX = sp.x - cos * size - sin * (size * 0.7);
      const leftY = sp.y - sin * size + cos * (size * 0.7);
      const rightX = sp.x - cos * size + sin * (size * 0.7);
      const rightY = sp.y - sin * size - cos * (size * 0.7);

      const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      poly.setAttribute('points', `${tipX},${tipY} ${leftX},${leftY} ${rightX},${rightY}`);
      poly.setAttribute('fill', '#00f2fe');
      poly.setAttribute('opacity', '0.75');
      this.svgLayer.appendChild(poly);
    }

    // 1. Render Selection Gizmo for Selected Nodes
    for (const node of this.selectedNodes) {
      const s0 = this.worldToScreen(node.x, node.y, camera);
      const s1 = this.worldToScreen(
        node.x + (node.w || 40),
        node.y + (node.h || 40),
        camera
      );

      const w = s1.x - s0.x;
      const h = s1.y - s0.y;

      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', String(s0.x - 2));
      rect.setAttribute('y', String(s0.y - 2));
      rect.setAttribute('width', String(w + 4));
      rect.setAttribute('height', String(h + 4));
      rect.setAttribute('fill', 'none');
      rect.setAttribute('stroke', '#00f2fe');
      rect.setAttribute('stroke-width', '1.5');
      rect.setAttribute('stroke-dasharray', '4,3');
      this.svgLayer.appendChild(rect);

      // Corner handles
      const corners = [
        { x: s0.x - 2, y: s0.y - 2 },
        { x: s1.x + 2, y: s0.y - 2 },
        { x: s1.x + 2, y: s1.y + 2 },
        { x: s0.x - 2, y: s1.y + 2 },
      ];

      for (const pt of corners) {
        const handle = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        handle.setAttribute('x', String(pt.x - 3));
        handle.setAttribute('y', String(pt.y - 3));
        handle.setAttribute('width', '6');
        handle.setAttribute('height', '6');
        handle.setAttribute('fill', '#ffffff');
        handle.setAttribute('stroke', '#00f2fe');
        handle.setAttribute('stroke-width', '1');
        this.svgLayer.appendChild(handle);
      }
    }

    // 2. Render Hovered Connection Ports
    for (const port of this.hoveredPorts) {
      const sp = this.worldToScreen(port.worldX, port.worldY, camera);

      // Outer pulsating halo
      const halo = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      halo.setAttribute('cx', String(sp.x));
      halo.setAttribute('cy', String(sp.y));
      halo.setAttribute('r', '8');
      halo.setAttribute('fill', 'rgba(0, 242, 254, 0.25)');
      halo.setAttribute('stroke', '#00f2fe');
      halo.setAttribute('stroke-width', '1.5');
      this.svgLayer.appendChild(halo);

      // Inner port dot
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('cx', String(sp.x));
      dot.setAttribute('cy', String(sp.y));
      dot.setAttribute('r', '3');
      dot.setAttribute('fill', '#ffffff');
      this.svgLayer.appendChild(dot);
    }

    // 3. Render Live Pipeline Routing Preview
    if (this.routePreviewPoints && this.routePreviewPoints.length >= 2) {
      const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      let d = '';
      for (let i = 0; i < this.routePreviewPoints.length; i++) {
        const pt = this.worldToScreen(this.routePreviewPoints[i].x, this.routePreviewPoints[i].y, camera);
        d += (i === 0 ? 'M ' : ' L ') + `${pt.x} ${pt.y}`;
      }
      pathEl.setAttribute('d', d);
      pathEl.setAttribute('fill', 'none');
      pathEl.setAttribute('stroke', '#00f2fe');
      pathEl.setAttribute('stroke-width', '2.5');
      pathEl.setAttribute('stroke-dasharray', '6,4');
      this.svgLayer.appendChild(pathEl);
    }

    // 4. Render Marquee Box Selection
    if (this.marqueeRect) {
      const p1 = this.worldToScreen(this.marqueeRect.x1, this.marqueeRect.y1, camera);
      const p2 = this.worldToScreen(this.marqueeRect.x2, this.marqueeRect.y2, camera);

      const mx = Math.min(p1.x, p2.x);
      const my = Math.min(p1.y, p2.y);
      const mw = Math.abs(p2.x - p1.x);
      const mh = Math.abs(p2.y - p1.y);

      const mRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      mRect.setAttribute('x', String(mx));
      mRect.setAttribute('y', String(my));
      mRect.setAttribute('width', String(mw));
      mRect.setAttribute('height', String(mh));
      mRect.setAttribute('fill', 'rgba(0, 242, 254, 0.12)');
      mRect.setAttribute('stroke', '#00f2fe');
      mRect.setAttribute('stroke-width', '1.5');
      mRect.setAttribute('stroke-dasharray', '3,3');
      this.svgLayer.appendChild(mRect);
    }

    // 5. Render DRC Validation Badges
    for (const issue of this.validationIssues) {
      const sp = this.worldToScreen(issue.x, issue.y, camera);
      const badge = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      badge.setAttribute('cx', String(sp.x));
      badge.setAttribute('cy', String(sp.y));
      badge.setAttribute('r', '6');
      badge.setAttribute('fill', issue.severity === 'error' ? '#ff4d4f' : '#faad14');
      badge.setAttribute('stroke', '#ffffff');
      badge.setAttribute('stroke-width', '1.5');

      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = issue.message;
      badge.appendChild(title);
      this.svgLayer.appendChild(badge);
    }
  }

  /**
   * Spawns an inline input editor directly over the element in screen space.
   */
  public startInlineEditing(
    elementId: string,
    currentText: string,
    worldX: number,
    worldY: number,
    camera: CameraState
  ): void {
    if (this.textEditorInput) {
      this.cancelInlineEditing();
    }

    const sp = this.worldToScreen(worldX, worldY, camera);

    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentText;
    input.className = 'inline-tag-editor';
    input.style.position = 'absolute';
    input.style.left = `${sp.x}px`;
    input.style.top = `${sp.y}px`;
    input.style.transform = 'translate(-50%, -50%)';
    input.style.pointerEvents = 'auto';
    input.style.zIndex = '100';

    const commit = () => {
      const val = input.value.trim();
      if (val && val !== currentText) {
        this.callbacks.onTextEdited?.(elementId, val);
      }
      this.cancelInlineEditing();
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.cancelInlineEditing();
      }
    });

    input.addEventListener('blur', commit);

    this.container.appendChild(input);
    input.focus();
    input.select();
    this.textEditorInput = input;
  }

  public cancelInlineEditing(): void {
    if (this.textEditorInput && this.textEditorInput.parentElement) {
      this.textEditorInput.parentElement.removeChild(this.textEditorInput);
      this.textEditorInput = null;
    }
  }

  private worldToScreen(wx: number, wy: number, camera: CameraState): Point2D {
    const { x, y, zoom, viewportWidth, viewportHeight } = camera;
    const sx = (wx - x) * zoom + viewportWidth * 0.5;
    const sy = (wy - y) * zoom + viewportHeight * 0.5;
    return { x: sx, y: sy };
  }

  public dispose(): void {
    this.cancelInlineEditing();
    if (this.container.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }
  }
}


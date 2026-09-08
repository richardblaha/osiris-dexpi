import { Cell, Graph, InternalEvent } from '@maxgraph/core';

export type LodLevel = 'lod-detail' | 'lod-medium' | 'lod-low';

const LOD_CLASSES: LodLevel[] = ['lod-detail', 'lod-medium', 'lod-low'];

/**
 * Maps the current view scale to a level-of-detail class on the graph's root
 * SVG element. The heavy lifting (hiding ports, dropping labels, flattening
 * symbols) is pure CSS keyed off `.lod-*` — see webview.css.
 *
 *  - `lod-detail`  scale > 0.7   — ports, snap points, every label, icons
 *  - `lod-medium`  0.35–0.7      — no ports, main label only, no shadows
 *  - `lod-low`     scale < 0.35  — flat coloured blocks, plain connector lines
 */
export class LodController {
  private current: LodLevel | null = null;
  private readonly onScale = () => this.apply();

  constructor(
    private readonly graph: Graph,
    private readonly container: HTMLElement
  ) {}

  public start(): void {
    const view = this.graph.getView();
    view.addListener(InternalEvent.SCALE, this.onScale);
    view.addListener(InternalEvent.SCALE_AND_TRANSLATE, this.onScale);
    this.apply();
  }

  public dispose(): void {
    const view = this.graph.getView();
    view.removeListener(this.onScale);
    for (const cls of LOD_CLASSES) this.rootSvg()?.classList.remove(cls);
  }

  public apply(): void {
    const level = LodController.levelForScale(this.graph.getView().scale);
    const svg = this.rootSvg();
    if (svg) {
      for (const cls of LOD_CLASSES) svg.classList.toggle(cls, cls === level);
    }

    // Ports are individual cells with no stable CSS hook — toggle them directly.
    const showPorts = level === 'lod-detail';
    if (showPorts !== (this.current === 'lod-detail') || this.current === null) {
      for (const port of this.portCells()) {
        const node = this.graph.getView().getState(port)?.shape?.node;
        if (node) node.style.display = showPorts ? '' : 'none';
      }
    }

    this.current = level;
  }

  private portCells(): Cell[] {
    const ports: Cell[] = [];
    for (const eq of this.graph.getDefaultParent().children ?? []) {
      for (const child of eq.children ?? []) {
        if ((child as { dexpiMetadata?: { elementType?: string } }).dexpiMetadata?.elementType === 'Nozzle') {
          ports.push(child);
        }
      }
    }
    return ports;
  }

  public static levelForScale(scale: number): LodLevel {
    if (scale < 0.35) return 'lod-low';
    if (scale <= 0.7) return 'lod-medium';
    return 'lod-detail';
  }

  private rootSvg(): SVGSVGElement | null {
    return this.container.querySelector('svg');
  }
}

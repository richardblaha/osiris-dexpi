import { Cell, Graph, Point } from '@maxgraph/core';
import type { PidView, PidViewNode, PidViewEdge, PidNodeKind, PidEdgeKind } from '../model/view/projection';
import { projectToView } from '../model/view/projection';
import { applyViewToModel } from '../model/view/apply';
import type { DexpiModel } from '../model/classes/dexpiModel';
import { STYLE_NAMES } from './styles';
import { catalogStencilFor } from './stencils/catalog';

export interface CellMetadata {
  elementType: string;
  dexpiId: string;
  dexpiClass: string;
  viewKind: PidNodeKind | PidEdgeKind;
  sourcePath?: string[];
  systemId?: string;
  segmentId?: string;
  loopId?: string;
  attributes?: Record<string, unknown>;
}

export class DexpiMaxGraphAdapter {
  /**
   * Translates a PidView projection (or DexpiModel) into a maxGraph model.
   */
  public dexpiToGraph(viewOrModel: PidView | any, graph: Graph): void {
    const view: PidView = 'nodes' in viewOrModel ? (viewOrModel as PidView) : projectToView(viewOrModel);

    const parent = graph.getDefaultParent();
    const modelTransaction = graph.getDataModel();

    modelTransaction.beginUpdate();
    try {
      // Clear existing cells
      const cellsToRemove = parent.children ? [...parent.children] : [];
      for (const c of cellsToRemove) {
        graph.removeCells([c], true);
      }

      const cellLookup = new Map<string, Cell>();

      // 1. Render primary nodes (equipment, valves, instruments, actuators)
      const primaryNodes = view.nodes.filter((n) => !n.parentId);
      for (const node of primaryNodes) {
        let styleName: string = STYLE_NAMES.EQUIPMENT;
        let stencilType: 'Equipment' | 'PipingComponent' | 'ProcessInstrument' = 'Equipment';

        if (node.kind === 'pipingComponent') {
          styleName = STYLE_NAMES.VALVE;
          stencilType = 'PipingComponent';
        } else if (node.kind === 'instrument') {
          styleName = STYLE_NAMES.INSTRUMENT;
          stencilType = 'ProcessInstrument';
        } else if (node.kind === 'actuator') {
          styleName = STYLE_NAMES.VALVE;
          stencilType = 'PipingComponent';
        }

        const cell = graph.insertVertex(
          parent,
          node.id,
          node.tagName,
          node.x,
          node.y,
          node.w,
          node.h,
          {
            baseStyleNames: [styleName],
            shape: catalogStencilFor(stencilType, node.dexpiClass),
          }
        );

        const meta: CellMetadata = {
          elementType: node.kind.charAt(0).toUpperCase() + node.kind.slice(1),
          dexpiId: node.id,
          dexpiClass: node.dexpiClass,
          viewKind: node.kind,
          sourcePath: node.sourcePath,
          attributes: node.attributes,
        };
        (cell as any).dexpiMetadata = meta;
        cellLookup.set(node.id, cell);
      }

      // 2. Render child nodes (e.g. nozzles relative to equipment)
      const childNodes = view.nodes.filter((n) => n.parentId);
      for (const node of childNodes) {
        const parentCell = cellLookup.get(node.parentId!);
        if (!parentCell) continue;

        const relX = node.portRel ? node.portRel.x : 0;
        const relY = node.portRel ? node.portRel.y : 0.5;

        const portCell = graph.insertVertex(
          parentCell,
          node.id,
          node.tagName,
          relX,
          relY,
          node.w,
          node.h,
          { baseStyleNames: [STYLE_NAMES.NOZZLE] },
          true // relative geometry
        );

        const meta: CellMetadata = {
          elementType: 'Nozzle',
          dexpiId: node.id,
          dexpiClass: node.dexpiClass,
          viewKind: 'nozzle',
          sourcePath: node.sourcePath,
          attributes: node.attributes,
        };
        (portCell as any).dexpiMetadata = meta;
        cellLookup.set(node.id, portCell);
      }

      // 3. Render edges
      for (const edge of view.edges) {
        const sourceCell =
          (edge.sourceNode ? cellLookup.get(edge.sourceNode) : undefined) ||
          cellLookup.get(edge.sourceId);
        const targetCell =
          (edge.targetNode ? cellLookup.get(edge.targetNode) : undefined) ||
          cellLookup.get(edge.targetId);

        if (sourceCell && targetCell) {
          const style = edge.kind === 'signal' ? STYLE_NAMES.SIGNAL_LINE : STYLE_NAMES.PIPELINE;
          const edgeCell = graph.insertEdge(parent, edge.id, edge.label || '', sourceCell, targetCell, {
            baseStyleNames: [style],
          });

          const meta: CellMetadata = {
            elementType: edge.kind === 'signal' ? 'SignalLine' : 'Pipeline',
            dexpiId: edge.id,
            dexpiClass: edge.dexpiClass,
            viewKind: edge.kind,
            sourcePath: edge.sourcePath,
            attributes: edge.attributes,
          };
          (edgeCell as any).dexpiMetadata = meta;

          if (edge.waypoints && edge.waypoints.length > 0) {
            const geo = edgeCell.getGeometry();
            if (geo) {
              geo.points = edge.waypoints.map((pt) => new Point(pt.x, pt.y));
            }
          }
        }
      }
    } finally {
      modelTransaction.endUpdate();
    }
  }

  /**
   * Synchronizes visual maxGraph mutations back into a PidView projection.
   */
  public graphToView(graph: Graph): PidView {
    const parent = graph.getDefaultParent();
    const children = parent.children || [];

    const nodes: PidViewNode[] = [];
    const edges: PidViewEdge[] = [];

    for (const cell of children) {
      if (!cell.id) continue;
      const meta = (cell as any).dexpiMetadata as CellMetadata | undefined;

      if (cell.isEdge()) {
        const source = cell.getTerminal(true);
        const target = cell.getTerminal(false);
        if (!source || !target) continue;

        const waypoints: { x: number; y: number }[] = [];
        const geo = cell.getGeometry();
        if (geo && geo.points) {
          for (const pt of geo.points) {
            waypoints.push({ x: pt.x, y: pt.y });
          }
        }

        const sourceMeta = (source as any).dexpiMetadata as CellMetadata | undefined;
        const targetMeta = (target as any).dexpiMetadata as CellMetadata | undefined;

        const kind: PidEdgeKind = meta?.viewKind === 'signal' ? 'signal' : 'pipe';

        edges.push({
          id: cell.id,
          kind,
          dexpiClass: meta?.dexpiClass || (kind === 'signal' ? 'SignalConveyingFunction' : 'PipingNetworkSegment'),
          sourceId: sourceMeta?.dexpiId || source.id || '',
          sourceNode: sourceMeta?.viewKind === 'nozzle' ? sourceMeta.dexpiId : undefined,
          targetId: targetMeta?.dexpiId || target.id || '',
          targetNode: targetMeta?.viewKind === 'nozzle' ? targetMeta.dexpiId : undefined,
          waypoints,
          label: typeof cell.value === 'string' ? cell.value : undefined,
          attributes: (meta?.attributes as Record<string, string>) || {},
          sourcePath: meta?.sourcePath,
        });
      } else {
        // Vertex
        const geo = cell.getGeometry();
        const x = geo ? Math.round(geo.x) : 0;
        const y = geo ? Math.round(geo.y) : 0;
        const w = geo ? Math.round(geo.width) : 80;
        const h = geo ? Math.round(geo.height) : 80;

        const kind: PidNodeKind = (meta?.viewKind as PidNodeKind) || 'equipment';
        const tagName = typeof cell.value === 'string' ? cell.value : cell.id;

        const node: PidViewNode = {
          id: cell.id,
          kind,
          dexpiClass: meta?.dexpiClass || 'Equipment',
          tagName,
          x,
          y,
          w,
          h,
          attributes: (meta?.attributes as Record<string, string>) || {},
          sourcePath: meta?.sourcePath,
        };
        nodes.push(node);

        // Child nozzle cells
        if (cell.children && cell.children.length > 0) {
          for (const child of cell.children) {
            const childGeo = child.getGeometry();
            const childMeta = (child as any).dexpiMetadata as CellMetadata | undefined;
            const portRel = childGeo ? { x: childGeo.x, y: childGeo.y } : { x: 0, y: 0.5 };
            const absX = Math.round(x + portRel.x * w);
            const absY = Math.round(y + portRel.y * h);

            nodes.push({
              id: child.id || '',
              kind: 'nozzle',
              dexpiClass: 'Nozzle',
              tagName: typeof child.value === 'string' ? child.value : (child.id || ''),
              x: absX,
              y: absY,
              w: childGeo ? Math.round(childGeo.width) : 8,
              h: childGeo ? Math.round(childGeo.height) : 8,
              parentId: cell.id,
              portRel,
              attributes: (childMeta?.attributes as Record<string, string>) || {},
              sourcePath: childMeta?.sourcePath,
            });
          }
        }
      }
    }

    return {
      nodes,
      edges,
      labels: [],
      bounds: { x: 0, y: 0, w: 1600, h: 900 },
    };
  }

  /**
   * Synchronizes visual maxGraph mutations back into an updated DexpiModel.
   */
  public graphToDexpi(graph: Graph, baseModel: DexpiModel): DexpiModel {
    const view = this.graphToView(graph);
    return applyViewToModel(view, baseModel);
  }
}

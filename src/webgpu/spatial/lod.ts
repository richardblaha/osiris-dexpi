/**
 * Dynamic Level of Detail (LOD) Controller for P&ID Schematics
 */

export enum LodLevel {
  OVERVIEW = 0, // Zoom < 0.15: Plant overview (only vessels, large columns, trunk pipelines)
  MEDIUM = 1,   // Zoom 0.15 - 0.60: Standard P&ID view (all components, equipment KKS tags)
  DETAILED = 2, // Zoom > 0.60: Engineering view (all nozzles, instruments, full pipe codes)
}

export interface LodThresholds {
  overviewMaxZoom: number;
  mediumMaxZoom: number;
}

export const DEFAULT_LOD_THRESHOLDS: LodThresholds = {
  overviewMaxZoom: 0.15,
  mediumMaxZoom: 0.6,
};

export class LodManager {
  public static getLevel(zoom: number, thresholds = DEFAULT_LOD_THRESHOLDS): LodLevel {
    if (zoom < thresholds.overviewMaxZoom) {
      return LodLevel.OVERVIEW;
    }
    if (zoom < thresholds.mediumMaxZoom) {
      return LodLevel.MEDIUM;
    }
    return LodLevel.DETAILED;
  }

  /**
   * Evaluates whether an element with a given kind and size should be rendered at the given zoom level.
   */
  public static shouldRenderElement(
    kind: string,
    isMajorEquipment: boolean,
    zoom: number,
    thresholds = DEFAULT_LOD_THRESHOLDS
  ): boolean {
    const level = this.getLevel(zoom, thresholds);

    switch (level) {
      case LodLevel.OVERVIEW:
        // In overview, render only major equipment and trunk segments
        return isMajorEquipment || kind === 'equipment';

      case LodLevel.MEDIUM:
        // In medium zoom, render everything except minor auxiliary nozzles
        return kind !== 'nozzleAuxiliary';

      case LodLevel.DETAILED:
        // Render all elements
        return true;
    }
  }

  /**
   * Returns minimum zoom requirement to pack into SymbolInstance.lod_min_zoom.
   */
  public static getMinZoomForKind(kind: string): number {
    switch (kind) {
      case 'equipment':
        return 0.0;
      case 'pipingComponent': // valves, pumps
        return 0.08;
      case 'instrument':
        return 0.15;
      case 'nozzle':
        return 0.35;
      default:
        return 0.0;
    }
  }
}


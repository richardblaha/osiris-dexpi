import { CellStateStyle, Stylesheet } from '@maxgraph/core';

export const STYLE_NAMES = {
  EQUIPMENT: 'pidEquipment',
  VALVE: 'pidValve',
  INSTRUMENT: 'pidInstrument',
  NOZZLE: 'pidNozzle',
  PIPELINE: 'pidPipeline',
  SIGNAL_LINE: 'pidSignalLine',
} as const;

export interface PidStyleTokens {
  /** Symbol / line stroke colour. */
  stroke: string;
  /** Symbol fill (usually the drawing background so overlaps read cleanly). */
  fill: string;
  /** Label colour. */
  font: string;
  /** Instrument bubble fill. */
  instrumentFill: string;
  fontFamily: string;
}

/** Neutral defaults for headless / test use; the webview overrides these from CSS vars. */
export const DEFAULT_PID_TOKENS: PidStyleTokens = {
  stroke: '#1b1b1b',
  fill: '#ffffff',
  font: '#1b1b1b',
  instrumentFill: '#ffffff',
  fontFamily: 'Helvetica, Arial, "Segoe UI", sans-serif',
};

/**
 * Configures a professional, theme-aware monochrome P&ID stylesheet.
 * Symbols are black-on-white / white-on-dark; the Osiris accent is reserved for
 * selection and hover (applied on the graph, not in these styles).
 */
export function configureOsirisStylesheet(
  stylesheet: Stylesheet,
  tokens: PidStyleTokens = DEFAULT_PID_TOKENS
): void {
  const { stroke, fill, font, instrumentFill, fontFamily } = tokens;

  const defaultVertex: CellStateStyle = {
    shape: 'rectangle',
    fillColor: fill,
    strokeColor: stroke,
    strokeWidth: 1,
    fontColor: font,
    fontFamily,
    fontSize: 11,
    verticalAlign: 'top',
    verticalLabelPosition: 'bottom',
    labelPosition: 'center',
    align: 'center',
    rounded: false,
    shadow: false,
  };
  stylesheet.putDefaultVertexStyle(defaultVertex);

  const processLine: CellStateStyle = {
    shape: 'connector',
    strokeColor: stroke,
    strokeWidth: 1.4,
    endArrow: 'none',
    startArrow: 'none',
    fontColor: font,
    fontFamily,
    fontSize: 10,
    rounded: false,
    edgeStyle: 'orthogonalEdgeStyle',
    jettySize: 'auto',
    orthogonalLoop: true,
  };
  stylesheet.putDefaultEdgeStyle(processLine);
  stylesheet.putCellStyle(STYLE_NAMES.PIPELINE, { ...processLine });

  const equipmentStyle: CellStateStyle = {
    fillColor: fill,
    strokeColor: stroke,
    strokeWidth: 1.2,
    fontColor: font,
    fontFamily,
    fontSize: 11,
    fontStyle: 1,
    verticalAlign: 'top',
    verticalLabelPosition: 'bottom',
    align: 'center',
  };
  stylesheet.putCellStyle(STYLE_NAMES.EQUIPMENT, equipmentStyle);

  stylesheet.putCellStyle(STYLE_NAMES.VALVE, {
    fillColor: fill,
    strokeColor: stroke,
    strokeWidth: 1,
    fontColor: font,
    fontFamily,
    fontSize: 9,
    verticalAlign: 'top',
    verticalLabelPosition: 'bottom',
    align: 'center',
  });

  stylesheet.putCellStyle(STYLE_NAMES.INSTRUMENT, {
    fillColor: instrumentFill,
    strokeColor: stroke,
    strokeWidth: 1,
    fontColor: font,
    fontFamily,
    fontSize: 10,
    fontStyle: 1,
    verticalAlign: 'middle',
    verticalLabelPosition: 'middle',
    labelPosition: 'center',
    align: 'center',
  });

  const nozzleStyle: CellStateStyle = {
    shape: 'ellipse',
    fillColor: fill,
    strokeColor: stroke,
    strokeWidth: 1,
    perimeter: 'ellipsePerimeter',
    fontColor: font,
    fontFamily,
    fontSize: 8,
    verticalAlign: 'middle',
    align: 'center',
  };
  stylesheet.putCellStyle(STYLE_NAMES.NOZZLE, nozzleStyle);

  const signalLineStyle: CellStateStyle = {
    shape: 'connector',
    strokeColor: stroke,
    strokeWidth: 1,
    dashed: true,
    dashPattern: '3 3',
    endArrow: 'none',
    fontColor: font,
    fontFamily,
    fontSize: 9,
    rounded: false,
    edgeStyle: 'orthogonalEdgeStyle',
    jettySize: 'auto',
    orthogonalLoop: true,
  };
  stylesheet.putCellStyle(STYLE_NAMES.SIGNAL_LINE, signalLineStyle);
}

/**
 * Precise native (pre-`<Scale>`) geometry for DEXPI/Proteus `ComponentName` shapes.
 *
 * Proteus XML tags almost every equipment/piping-component/instrument element with
 * a `ComponentName` (e.g. "GLOBE_VALVE_SHAPE", "VESSEL_WITH_DISHED_HEADS_SHAPE") —
 * a far more precise signal for which symbol to draw than guessing from
 * `ComponentClass` alone. There is no Proteus-native-size catalog bundled with a
 * DEXPI instance file, so these primitives were transcribed directly from a
 * pyDEXPI reference render's own output (cross-checked against real file data,
 * e.g. a GlobeValve's `Scale X="0.4"` against the 4mm gap between its two
 * connection-point positions: 10 * 0.4 = 4 — matching this table's 10x5 native box).
 *
 * Coordinates are centered on the component's own origin (its `<Position>`), in
 * the same units Proteus expresses `<Scale>` against — multiply by the instance's
 * Scale (and the app's own unit/page scale) to get final world-space geometry.
 */

export type ShapePrimitive =
  | { kind: 'polyline'; points: [number, number][] }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number; fillBackground?: boolean }
  | { kind: 'arc'; from: [number, number]; to: [number, number]; r: number; largeArc?: 0 | 1; sweep?: 0 | 1 };

export interface ComponentShapeDef {
  /** Native bounding box, centered on the shape's own origin. */
  w: number;
  h: number;
  primitives: ShapePrimitive[];
}

const poly = (...points: [number, number][]): ShapePrimitive => ({ kind: 'polyline', points });
const ell = (cx: number, cy: number, rx: number, ry: number, fillBackground?: boolean): ShapePrimitive => ({
  kind: 'ellipse',
  cx,
  cy,
  rx,
  ry,
  fillBackground,
});
const arc = (from: [number, number], to: [number, number], r: number): ShapePrimitive => ({
  kind: 'arc',
  from,
  to,
  r,
  largeArc: 0,
  sweep: 0,
});

export const COMPONENT_SHAPES: Record<string, ComponentShapeDef> = {
  GLOBE_VALVE_SHAPE: {
    w: 10,
    h: 5,
    primitives: [poly([-5, -2.5], [5, 2.5], [5, -2.5], [-5, 2.5], [-5, -2.5]), ell(0, 0, 1.25, 1.25)],
  },
  BALL_VALVE_SHAPE: {
    w: 10,
    h: 5,
    primitives: [
      poly([-5, -2.5], [5, 2.5], [5, -2.5], [-5, 2.5], [-5, -2.5]),
      ell(0, 0, 2.5, 2.5, true),
      ell(0, 0, 2.5, 2.5),
    ],
  },
  BUTTERFLY_VALVE_SHAPE: {
    w: 10,
    h: 5,
    primitives: [poly([-5, -2.5], [5, 2.5], [-5, 2.5], [-5, -2.5], [5, -2.5], [5, 2.5]), ell(0, 0, 1.25, 1.25)],
  },
  SWING_CHECK_VALVE_SHAPE: {
    w: 10,
    h: 5,
    primitives: [poly([-5, -2.5], [-5, 2.5], [5, 2.5], [5, -2.5], [-5, -2.5], [5, 2.5]), ell(-5, -2.5, 1.25, 1.25)],
  },
  GATE_VALVE_SHAPE: {
    w: 10,
    h: 5,
    primitives: [poly([-5, -2.5], [5, 2.5], [5, -2.5], [-5, 2.5], [-5, -2.5])],
  },
  REDUCER_GENERAL_SHAPE: {
    w: 10,
    h: 5,
    primitives: [poly([-5, -2.5], [5, 0], [-5, 2.5], [-5, -2.5])],
  },
  ANGLE_SAFETY_VALVE_SPRING_LOADED_SHAPE: {
    w: 7.5,
    h: 17.5,
    primitives: [
      poly([0, 0], [5, -2.5], [5, 2.5], [0, 0], [2.5, 5], [-2.5, 5], [0, 0]),
      poly([3.525, -2.5], [3.525, 2.5], [3.775, 2.5], [3.775, -2.5], [3.525, -2.5]),
      poly([0, 0], [0, -2.5], [-2.5, -3.75], [2.5, -5.83333], [-2.5, -7.91666], [2.5, -10.0], [0, -11.25], [0, -12.5]),
      ell(0, 0, 1.25, 1.25),
    ],
  },
  CENTRIFUGAL_PUMP_SHAPE: {
    w: 15,
    h: 15,
    primitives: [ell(0, 0, 7.5, 7.5), poly([-7.5, 0], [7.5, 0]), poly([0, 7.5], [7.5, 0], [0, -7.5])],
  },
  RECIPROCATING_PUMP_SHAPE: {
    w: 15,
    h: 15,
    primitives: [
      ell(0, 0, 7.5, 7.5),
      poly([0, -7.5], [7.5, 0]),
      poly([0, 7.5], [7.5, 0]),
      poly([-2.5, 0], [2.5, 0]),
      poly([2.5, -2.5], [2.5, 2.5]),
    ],
  },
  VESSEL_WITH_DISHED_HEADS_SHAPE: {
    w: 20,
    h: 30,
    primitives: [
      poly([10, 12.5], [10, -12.5]),
      arc([10, -12.5], [-10, -12.5], 21.25),
      poly([-10, -12.5], [-10, 12.5]),
      arc([-10, 12.5], [10, 12.5], 21.25),
    ],
  },
  // PLATE_TYPE_HEAT_EXCHANGER_SHAPE and FLOATING_HEAD_TUBE_BUNDLE_HEAT_EXCHANGER_SHAPE
  // intentionally omitted: this hand-rolled approximation drew a short, wide box
  // with a single crosshatch, when the real pyDEXPI reference render (and the
  // vendored draw.io "Plate and Frame Heat Exchanger" / "Heat Exchanger (Straight
  // Tubes)" stencils in maxgraph/stencils/vendor/heat_exchangers.xml) draw a tall
  // multi-plate box and a tube-bundle box respectively — genuinely different
  // shapes, not just differently scaled. Leaving these two out of this table lets
  // `renderNodeBody` (exportSvg.ts) fall through to those stencils instead. The
  // native w/h used for Scale-based sizing lives on in `getNominalEquipmentSize`
  // below (30x10 / 35x10), unchanged.
  CONTROLLED_ACTUATOR_SHAPE: {
    w: 18,
    h: 9,
    primitives: [ell(13.5, 0, 4.5, 4.5), poly([9, 0], [0, 0])],
  },
  MANHOLE_SHAPE: {
    w: 13.5,
    h: 15,
    primitives: [poly([0, -5], [10, -5], [10, -7.5]), poly([0, 5], [10, 5], [10, 7.5]), poly([13.5, -7.5], [13.5, 7.5])],
  },
  NOZZLE_SHAPE: {
    w: 5,
    h: 5,
    primitives: [poly([5, -2.5], [5, 2.5]), poly([5, 0], [0, 0])],
  },
  INSTRUMENTATION_BUBBLE_SHAPE_FIELD: {
    w: 13.5,
    h: 7.5,
    primitives: [poly([-3, -3.75], [3, -3.75]), arc([-3, -3.75], [-3, 3.75], 3.75), poly([-3, 3.75], [3, 3.75]), arc([3, 3.75], [3, -3.75], 3.75)],
  },
  INSTRUMENTATION_BUBBLE_SHAPE_CENTRAL: {
    w: 13.5,
    h: 7.5,
    primitives: [
      poly([-3, -3.75], [3, -3.75]),
      arc([-3, -3.75], [-3, 3.75], 3.75),
      poly([-3, 3.75], [3, 3.75]),
      arc([3, 3.75], [3, -3.75], 3.75),
      poly([-6.75, 0], [6.75, 0]),
    ],
  },
  ARROW_FOR_INLET_OF_ESSENTIAL_SUBSTANCES_SHAPE: {
    w: 10,
    h: 10,
    primitives: [poly([-10, 2.5], [-10, -2.5], [-5, -2.5], [-5, -5], [0, 0], [-5, 5], [-5, 2.5], [-10, 2.5])],
  },
  ARROW_FOR_OUTLET_OF_ESSENTIAL_SUBSTANCES_SHAPE: {
    w: 10,
    h: 10,
    primitives: [poly([0, 2.5], [0, -2.5], [5, -2.5], [5, -5], [10, 0], [5, 5], [5, 2.5], [0, 2.5])],
  },
  BLIND_COVER_SHAPE: {
    w: 1,
    h: 5,
    primitives: [poly([0, -2.5], [0, 2.5])],
  },
  T_TYPE_CONNECTION_SHAPE: { w: 0, h: 0, primitives: [] },
};

export function getComponentShape(componentName?: string): ComponentShapeDef | undefined {
  if (!componentName) return undefined;
  return COMPONENT_SHAPES[componentName];
}

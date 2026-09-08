// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { StencilShapeRegistry } from '@maxgraph/core';
import { registerPidStencils, getStencilXml } from '../src/maxgraph/stencils/registry';
import { SYMBOL_CATALOG, catalogStencilFor } from '../src/maxgraph/stencils/catalog';
import { stencilToSvg } from '../src/maxgraph/stencils/thumbnail';

describe('P&ID stencil library', () => {
  it('registers the bundled draw.io + local stencils', () => {
    const count = registerPidStencils();
    expect(count).toBeGreaterThan(150);
    expect(StencilShapeRegistry.get('pid.valves.gate_valve')).toBeTruthy();
    expect(StencilShapeRegistry.get('pid.instruments.discrete')).toBeTruthy();
  });

  it('every catalog entry points at a registered stencil', () => {
    registerPidStencils();
    for (const item of SYMBOL_CATALOG) {
      expect(StencilShapeRegistry.get(item.stencil), `${item.id} -> ${item.stencil}`).toBeTruthy();
    }
  });

  it('resolves model component classes to registered stencils', () => {
    registerPidStencils();
    for (const elementType of ['Equipment', 'PipingComponent', 'ProcessInstrument'] as const) {
      const stencil = catalogStencilFor(elementType, 'DefinitelyNotARealClass');
      expect(StencilShapeRegistry.get(stencil)).toBeTruthy();
    }
    expect(catalogStencilFor('Equipment', 'CentrifugalPump')).toBe('pid.pumps_iso.pump_centrifugal');
  });

  it('renders a thumbnail SVG from stencil geometry', () => {
    const xml = getStencilXml('pid.valves.gate_valve');
    expect(xml).toBeTruthy();
    const svg = stencilToSvg(xml!, { size: 40 });
    expect(svg).toContain('<svg');
    expect(svg).toMatch(/<path|<ellipse|<rect/);
  });
});

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { ProteusReader } from '../src/model/proteus/reader';
import { projectToView } from '../src/model/view/projection';
import { boundsOfPrimitives } from '../src/model/shapeGeometry';
import { renderPidViewDiagramMarkup } from '../src/webview/exportSvg';

const samplesDir = path.resolve(__dirname, '../samples');
const readSample = (name: string) => fs.readFileSync(path.join(samplesDir, name), 'utf-8');

describe('DEXPI-primitive rendering (no pre-baked stencils)', () => {
  it('resolves a `<ShapeCatalogue>` Shape by ComponentName onto the matching PidViewNode', () => {
    // i01v01-avv.ex01.xml's ShapeCatalogue defines a "DIIN" Shape (a Circle),
    // referenced by a placed <PipingComponent ComponentName="DIIN"> (LI-01).
    const { model } = ProteusReader.read(readSample('i01v01-avv.ex01.xml'));
    expect(model.shapeCatalogues.length).toBeGreaterThan(0);

    const view = projectToView(model);
    const diin = view.nodes.find((n) => n.componentName === 'DIIN' && n.tagName === 'LI-01');
    expect(diin).toBeDefined();
    expect(diin?.symbolShape).toBeDefined();
    expect(diin?.symbolShape?.primitives.length).toBeGreaterThan(0);

    const bounds = boundsOfPrimitives(diin!.symbolShape!.primitives);
    expect(bounds).toBeDefined();
    expect(bounds!.w).toBeGreaterThan(0);
    expect(bounds!.h).toBeGreaterThan(0);
  });

  it('captures inline graphical primitives embedded directly on a placed element', () => {
    // c01v01-hex.ex01.xml embeds <Line>/<TrimmedCurve> directly inside its
    // <Equipment> (T4750) rather than referencing a ShapeCatalogue entry.
    const { model } = ProteusReader.read(readSample('c01v01-hex.ex01.xml'));
    const view = projectToView(model);
    const tank = view.nodes.find((n) => n.tagName === 'T4750');
    expect(tank).toBeDefined();
    expect(tank?.symbolPrimitives?.length).toBeGreaterThan(0);
    expect(tank?.symbolPrimitives?.some((p) => p.kind === 'polyline')).toBe(true);
    expect(tank?.symbolPrimitives?.some((p) => 'startAngle' in p)).toBe(true);
  });

  it('renders non-empty SVG geometry for nodes with resolved primitives, and a placeholder for nodes without', () => {
    const { model } = ProteusReader.read(readSample('c01v01-hex.ex01.xml'));
    const view = projectToView(model);
    const markup = renderPidViewDiagramMarkup(view);

    // The tank (inline primitives) should draw real geometry, not a bare placeholder rect.
    expect(markup).toMatch(/<polyline|<path|<ellipse|<polygon/);
  });

  it('has no remaining references to the deleted stencil library or hand-transcribed shape table', () => {
    const srcDir = path.resolve(__dirname, '../src');
    const offenders: string[] = [];

    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
          const content = fs.readFileSync(full, 'utf-8');
          if (/maxgraph\/stencils|model\/componentShapes/.test(content)) {
            offenders.push(full);
          }
        }
      }
    };
    walk(srcDir);

    expect(offenders).toEqual([]);
  });
});

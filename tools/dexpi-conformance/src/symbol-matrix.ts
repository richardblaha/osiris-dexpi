/**
 * ISO 10628-2:2012 symbol coverage — first pass (see TEST_PLAN.md §8/§11).
 *
 * The ISO sheets in `resources/symbols/ISO_10628-2_2012_Symbols_Sheet_*.svg`
 * lay all 296 symbols out on an unlabelled Inkscape grid — no per-symbol id,
 * name, or group tag survives in the SVG/PDF. Cataloguing all 296 by hand
 * (matching grid cell -> symbol name -> our stencil) is a separate, larger
 * effort the user deferred past this pass. What we DO have without that work:
 * the group-level taxonomy (29 groups, count per group, 296 total) from
 * `fixtures/iso10628-2-groups.json`, and our own catalog's category field.
 *
 * This is deliberately a CATEGORY-level coverage report, not a symbol-level
 * one: for each of the 29 ISO groups, how many of our `SYMBOL_CATALOG` entries
 * fall into it (by a keyword heuristic below), versus the official count. A
 * group with catalog entries but a big shortfall, or zero entries at all, is
 * the gap list this pass promised. It answers "which *families* of ISO
 * symbols are we missing", not "which exact one of the 8 heat exchangers".
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { SYMBOL_CATALOG, type SymbolCatalogItem } from '../../../src/panel/symbolPalette.js';
import { FIXTURES_DIR, REPORT_DIR } from './paths.js';

interface IsoGroup {
  n: number;
  count: number;
  name: string;
  sheet: number;
}
interface IsoGroupsFile {
  totalSymbols: number;
  groups: IsoGroup[];
}

function loadGroups(): IsoGroupsFile {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'iso10628-2-groups.json'), 'utf-8')) as IsoGroupsFile;
}

/** Assigns a catalog item to an ISO 10628-2 group number, or null if the item
 * belongs to a different standard entirely (ISA-5.1 / ISO 14617 instrument
 * bubbles — ISO 10628-2 covers process equipment and piping, not instruments). */
function isoGroupFor(item: SymbolCatalogItem): number | null {
  const s = `${item.componentClass} ${item.label}`.toLowerCase();

  switch (item.category) {
    case 'Instruments':
      return null; // out of scope for ISO 10628-2 entirely
    case 'Vessels & Tanks':
      if (/column|tower/.test(s)) return 2;
      if (/filter/.test(s)) return 6; // Filters, Liquid Filters, Gas Filters
      if (/knock.?out/.test(s)) return 8; // Separators
      return 1;
    case 'Heat Exchangers':
      return 3;
    case 'Pumps & Compressors':
      return /compressor|vacuum/.test(s) ? 16 : 15;
    case 'Valves':
      if (/check/.test(s)) return 22;
      if (/safety|relief/.test(s)) return 23;
      return 21;
    case 'Fittings & Piping':
      if (/sight glass|flame arrestor|silencer|mixer|rupture disc/.test(s)) return 26;
      if (/flow|orifice|venturi|nozzle|meter/.test(s)) return 25;
      return 24;
    default:
      return null;
  }
}

export function renderSymbolMatrix(): void {
  const { totalSymbols, groups } = loadGroups();
  const byGroup = new Map<number, SymbolCatalogItem[]>();
  const outOfScope: SymbolCatalogItem[] = [];

  for (const item of SYMBOL_CATALOG) {
    const g = isoGroupFor(item);
    if (g == null) {
      outOfScope.push(item);
      continue;
    }
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g)!.push(item);
  }

  const rows = groups.map((g) => {
    const ours = byGroup.get(g.n) ?? [];
    return { ...g, ours: ours.length, items: ours };
  });

  const totalOurs = rows.reduce((s, r) => s + r.ours, 0);
  const zeroGroups = rows.filter((r) => r.ours === 0);

  const md: string[] = [];
  md.push('# ISO 10628-2:2012 symbol coverage — category-level pass 1', '');
  md.push(
    '> Group-level only — the ISO sheets have no per-symbol id/name to catalogue against ' +
      '(see the module docstring / TEST_PLAN.md §8, §11). This shows which *families* of ' +
      'ISO symbols our catalog represents at all, not a 1:1 symbol checklist.',
    ''
  );
  const coveredGroups = groups.length - zeroGroups.length;
  md.push(
    `Catalog: **${SYMBOL_CATALOG.length}** palette entries, placed into **${coveredGroups}/${groups.length}** ISO groups ` +
      `(${totalOurs} entries total; the 29 groups cover ${totalSymbols} ISO symbols).`,
    ''
  );
  md.push('| grp | ISO group | official count | our entries | gap |', '|---:|---|---:|---:|---|');
  for (const r of rows) {
    const gap = r.ours === 0 ? '**no coverage**' : r.ours < r.count / 4 ? 'thin' : '';
    md.push(`| ${r.n} | ${r.name} | ${r.count} | ${r.ours} | ${gap} |`);
  }
  md.push('', '## Zero-coverage groups (families with no catalog entry at all)', '');
  if (zeroGroups.length === 0) {
    md.push('_none — every group has at least one entry._');
  } else {
    for (const g of zeroGroups) md.push(`- **${g.n}. ${g.name}** (${g.count} ISO symbols)`);
  }
  md.push('', '## Our catalog entries by ISO group', '');
  for (const r of rows) {
    if (r.items.length === 0) continue;
    md.push(`### ${r.n}. ${r.name}`, '');
    for (const it of r.items) md.push(`- \`${it.componentClass}\` — ${it.label}`);
    md.push('');
  }
  md.push('## Out of scope for ISO 10628-2 (ISA-5.1 / ISO 14617 instruments)', '');
  for (const it of outOfScope) md.push(`- \`${it.componentClass}\` — ${it.label}`);

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(path.join(REPORT_DIR, 'symbol-matrix.md'), md.join('\n') + '\n');

  console.log(`symbol-matrix: ${SYMBOL_CATALOG.length} catalog entries -> ${totalOurs} placed across ${groups.length - zeroGroups.length}/${groups.length} ISO groups`);
  console.log(`  zero-coverage groups: ${zeroGroups.map((g) => g.n).join(', ') || 'none'}`);
  console.log('  report -> test-output/report/symbol-matrix.md');
}

/**
 * Renders the run report from results.json:
 *   test-output/report/index.html   – interactive, per-file, with thumbnails
 *   test-output/report/summary.md   – aggregate table + recurring findings
 *
 * Thumbnails are the already-generated SVGs referenced by relative path
 * (reference / ours / visual diff PNG when present).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { OURS_SVG_DIR, OFFICIAL_SVG_DIR, REF_SVG_DIR, REPORT_DIR, RESULTS_JSON } from './paths.js';
import type { ResultRow, RunResults } from './types.js';

function loadResults(): RunResults {
  if (!fs.existsSync(RESULTS_JSON)) throw new Error('results.json missing — run `diff` first');
  return JSON.parse(fs.readFileSync(RESULTS_JSON, 'utf-8')) as RunResults;
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

function rel(from: string, to: string): string {
  return path.relative(from, to).replace(/\\/g, '/');
}

function thumb(row: ResultRow): string {
  const ref = fs.existsSync(path.join(REF_SVG_DIR, `${row.id}.svg`))
    ? rel(REPORT_DIR, path.join(REF_SVG_DIR, `${row.id}.svg`))
    : fs.existsSync(path.join(OFFICIAL_SVG_DIR, `${row.id}.svg`))
    ? rel(REPORT_DIR, path.join(OFFICIAL_SVG_DIR, `${row.id}.svg`))
    : null;
  const ours = fs.existsSync(path.join(OURS_SVG_DIR, `${row.id}.svg`))
    ? rel(REPORT_DIR, path.join(OURS_SVG_DIR, `${row.id}.svg`))
    : null;
  const diff = fs.existsSync(path.join(REPORT_DIR, `${row.id}.diff.png`))
    ? rel(REPORT_DIR, path.join(REPORT_DIR, `${row.id}.diff.png`))
    : null;
  const cell = (src: string | null, label: string) =>
    src ? `<figure><img loading="lazy" src="${esc(src)}" alt="${label}"><figcaption>${label}</figcaption></figure>` : `<figure class="none"><figcaption>${label}: —</figcaption></figure>`;
  return `<div class="thumbs">${cell(ref, 'reference')}${cell(ours, 'ours')}${cell(diff, 'visual diff')}</div>`;
}

function statusClass(s: string): string {
  return { PASS: 'ok', WARN: 'warn', FAIL: 'fail', 'NO-REFERENCE': 'na' }[s] || '';
}

export function renderReport(): void {
  const results = loadResults();
  const s = results.summary;

  // aggregate: recurring findings by category + subject class
  const agg = new Map<string, number>();
  for (const row of results.rows)
    for (const f of row.findings) {
      const subj =
        (f.message.match(/reference symbol (\S+)/) || f.message.match(/our symbol (\S+)/) || [])[1] || '';
      const key = subj ? `${f.category} · ${subj}` : f.category;
      agg.set(key, (agg.get(key) || 0) + 1);
    }
  const topAgg = [...agg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);

  // ---- HTML ----
  const rowsHtml = results.rows
    .map((row) => {
      const findings = row.findings
        .map((f) => `<li class="sev-${Math.floor(f.severity / 20)}"><code>${f.category}</code> ${esc(f.message)}</li>`)
        .join('');
      const vis = row.visualMismatch != null ? `${(row.visualMismatch * 100).toFixed(1)}%${row.visualWayOff ? ' ⚠' : ''}` : '—';
      return `<details class="row ${statusClass(row.status)}">
  <summary>
    <span class="badge">${row.status}</span>
    <span class="id">${esc(row.id)}</span>
    <span class="score">struct ${(row.structuralScore * 100).toFixed(0)}%</span>
    <span class="score">sym ${row.counts.ourSymbols}/${row.counts.refSymbols}</span>
    <span class="score">conn ${row.counts.ourConnections}/${row.counts.refConnections}</span>
    <span class="score">visual ${vis}</span>
  </summary>
  ${thumb(row)}
  ${findings ? `<ul class="findings">${findings}</ul>` : '<p class="clean">no findings</p>'}
</details>`;
    })
    .join('\n');

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>DEXPI conformance report</title>
<style>
  :root { color-scheme: light dark; --ok:#1a7f37; --warn:#9a6700; --fail:#cf222e; --na:#666; }
  body { font: 14px/1.5 -apple-system, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 24px; max-width: 1100px; margin-inline: auto; }
  h1 { margin: 0 0 4px; } .meta { color: #888; margin-bottom: 16px; }
  .cards { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 20px; }
  .card { border: 1px solid #8884; border-radius: 8px; padding: 10px 16px; min-width: 90px; }
  .card b { display: block; font-size: 22px; }
  table.agg { border-collapse: collapse; width: 100%; margin: 12px 0 28px; }
  table.agg td { border-bottom: 1px solid #8883; padding: 3px 8px; }
  table.agg td:first-child { text-align: right; font-variant-numeric: tabular-nums; width: 60px; color: #888; }
  .row { border: 1px solid #8884; border-radius: 8px; margin-bottom: 8px; padding: 6px 10px; }
  .row.ok { border-left: 4px solid var(--ok); } .row.warn { border-left: 4px solid var(--warn); }
  .row.fail { border-left: 4px solid var(--fail); } .row.na { border-left: 4px solid var(--na); }
  summary { cursor: pointer; display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
  .badge { font-weight: 700; font-size: 11px; padding: 1px 6px; border-radius: 4px; background: #8882; }
  .ok .badge { color: var(--ok); } .warn .badge { color: var(--warn); } .fail .badge { color: var(--fail); }
  .id { font-family: ui-monospace, monospace; }
  .score { color: #888; font-size: 12px; font-variant-numeric: tabular-nums; }
  .thumbs { display: flex; gap: 12px; margin: 10px 0; flex-wrap: wrap; }
  .thumbs figure { margin: 0; border: 1px solid #8883; border-radius: 6px; padding: 6px; background: #fff; width: 320px; }
  .thumbs img { width: 100%; height: 220px; object-fit: contain; display: block; }
  .thumbs figcaption { font-size: 11px; color: #888; text-align: center; margin-top: 4px; }
  .thumbs .none { display: flex; align-items: center; justify-content: center; height: 234px; color: #aaa; }
  ul.findings { margin: 6px 0; padding-left: 18px; }
  ul.findings li { margin: 2px 0; }
  ul.findings code { background: #8882; padding: 0 4px; border-radius: 3px; font-size: 12px; }
  .sev-5 { color: var(--fail); } .sev-4 { color: var(--fail); } .sev-3 { color: var(--warn); }
  .clean { color: var(--ok); } .filters { margin-bottom: 12px; }
  .filters button { font: inherit; padding: 3px 10px; margin-right: 6px; border: 1px solid #8884; border-radius: 6px; background: #8881; cursor: pointer; }
</style></head><body>
<h1>DEXPI conformance report</h1>
<div class="meta">${esc(results.generatedAt)} · corpus of ${s.total} files with a graphical reference</div>
<div class="cards">
  <div class="card"><b>${s.pass}</b>PASS</div>
  <div class="card"><b>${s.warn}</b>WARN</div>
  <div class="card"><b>${s.fail}</b>FAIL</div>
  <div class="card"><b>${s.noReference}</b>no ref</div>
  <div class="card"><b>${(s.meanStructuralScore * 100).toFixed(1)}%</b>mean score</div>
</div>
<h2>Recurring findings</h2>
<table class="agg"><tbody>${topAgg.map(([k, v]) => `<tr><td>${v}</td><td>${esc(k)}</td></tr>`).join('')}</tbody></table>
<h2>Files</h2>
<div class="filters">
  <button data-f="all">all</button><button data-f="fail">FAIL</button>
  <button data-f="warn">WARN</button><button data-f="ok">PASS</button>
</div>
<div id="rows">
${rowsHtml}
</div>
<script>
  const rows = [...document.querySelectorAll('.row')];
  for (const b of document.querySelectorAll('.filters button'))
    b.onclick = () => { const f = b.dataset.f; for (const r of rows) r.hidden = f !== 'all' && !r.classList.contains(f); };
</script>
</body></html>`;

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(path.join(REPORT_DIR, 'index.html'), html);

  // ---- Markdown ----
  const md: string[] = [];
  md.push('# DEXPI conformance report', '');
  md.push(`_${results.generatedAt}_`, '');
  md.push('| metric | value |', '|---|---|');
  md.push(`| corpus (graphical) | ${s.total} |`);
  md.push(`| PASS | ${s.pass} |`);
  md.push(`| WARN | ${s.warn} |`);
  md.push(`| FAIL | ${s.fail} |`);
  md.push(`| no reference | ${s.noReference} |`);
  md.push(`| mean structural score | ${(s.meanStructuralScore * 100).toFixed(1)}% |`, '');
  md.push('## Recurring findings', '', '| count | finding |', '|---:|---|');
  for (const [k, v] of topAgg) md.push(`| ${v} | ${k} |`);
  md.push('', '## Per-file', '', '| status | id | score | sym (ours/ref) | conn | top finding |', '|---|---|---:|---|---|---|');
  for (const row of results.rows) {
    const top = row.findings[0] ? `${row.findings[0].category}: ${row.findings[0].message}` : '';
    md.push(
      `| ${row.status} | \`${row.id}\` | ${(row.structuralScore * 100).toFixed(0)}% | ${row.counts.ourSymbols}/${row.counts.refSymbols} | ${row.counts.ourConnections}/${row.counts.refConnections} | ${top.slice(0, 90)} |`
    );
  }
  fs.writeFileSync(path.join(REPORT_DIR, 'summary.md'), md.join('\n') + '\n');
}

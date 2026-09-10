/**
 * Baseline tracking. The suite starts mostly-FAIL, so CI must not gate on
 * absolute PASS — it gates on *regression vs a committed baseline*.
 *
 *   baseline            write fixtures/baseline.json from the current results
 *   check-regression    compare current results to the baseline; exit 1 on any
 *                       status regression or a structural-score drop > epsilon
 */
import * as fs from 'node:fs';
import { BASELINE_JSON, RESULTS_JSON } from './paths.js';
import type { RunResults } from './types.js';

const STATUS_RANK: Record<string, number> = { FAIL: 0, 'NO-REFERENCE': 1, WARN: 2, PASS: 3 };
const SCORE_EPSILON = 0.02;

interface BaselineRow {
  id: string;
  status: string;
  structuralScore: number;
}
interface Baseline {
  generatedAt: string;
  rows: BaselineRow[];
}

function loadResults(): RunResults {
  if (!fs.existsSync(RESULTS_JSON)) throw new Error('results.json missing — run `diff` first');
  return JSON.parse(fs.readFileSync(RESULTS_JSON, 'utf-8')) as RunResults;
}

export function writeBaseline(): void {
  const r = loadResults();
  const baseline: Baseline = {
    generatedAt: r.generatedAt,
    rows: r.rows.map((x) => ({ id: x.id, status: x.status, structuralScore: Number(x.structuralScore.toFixed(4)) })),
  };
  fs.writeFileSync(BASELINE_JSON, JSON.stringify(baseline, null, 2) + '\n');
  console.log(`baseline written: ${baseline.rows.length} rows → fixtures/baseline.json`);
}

export function checkRegression(): number {
  if (!fs.existsSync(BASELINE_JSON)) {
    console.error('no baseline.json — run `baseline` first');
    return 1;
  }
  const base = JSON.parse(fs.readFileSync(BASELINE_JSON, 'utf-8')) as Baseline;
  const cur = loadResults();
  const curById = new Map(cur.rows.map((r) => [r.id, r]));
  const regressions: string[] = [];
  const improvements: string[] = [];

  for (const b of base.rows) {
    const c = curById.get(b.id);
    if (!c) {
      regressions.push(`${b.id}: dropped from the corpus`);
      continue;
    }
    if (STATUS_RANK[c.status] < STATUS_RANK[b.status])
      regressions.push(`${b.id}: ${b.status} → ${c.status}`);
    else if (c.structuralScore < b.structuralScore - SCORE_EPSILON)
      regressions.push(`${b.id}: score ${(b.structuralScore * 100).toFixed(0)}% → ${(c.structuralScore * 100).toFixed(0)}%`);
    else if (STATUS_RANK[c.status] > STATUS_RANK[b.status] || c.structuralScore > b.structuralScore + SCORE_EPSILON)
      improvements.push(`${b.id}: ${b.status} ${(b.structuralScore * 100).toFixed(0)}% → ${c.status} ${(c.structuralScore * 100).toFixed(0)}%`);
  }

  for (const i of improvements) console.log(`  ✅ ${i}`);
  for (const r of regressions) console.error(`  ❌ ${r}`);
  console.log(`\n${improvements.length} improvement(s), ${regressions.length} regression(s)`);
  return regressions.length > 0 ? 1 : 0;
}

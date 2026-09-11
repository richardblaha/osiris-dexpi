/**
 * Non-blocking visual comparison.
 *
 * Each side's SVG is rendered to a fixed-size PNG by headless Chromium
 * (browser-faithful, matches what the editor webview would paint), flattened to
 * grayscale on a white ground so the Osiris theme colours don't dominate, then
 * pixelmatch'd. Writes test-output/report/<id>.diff.png and folds
 * `visualMismatch` / `visualWayOff` back into results.json.
 *
 * This NEVER changes a structural PASS/WARN/FAIL — it only annotates.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { chromium, type Browser } from 'playwright';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { CONFIG_JSON, OFFICIAL_SVG_DIR, OURS_SVG_DIR, REF_SVG_DIR, REPORT_DIR, RESULTS_JSON } from './paths.js';
import type { RunResults } from './types.js';

const W = 900;
const H = 650;

interface Cfg {
  visual: { hardFailRatio: number };
}

async function renderSvgToPng(browser: Browser, svg: string): Promise<Buffer> {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  try {
    const b64 = Buffer.from(svg, 'utf-8').toString('base64');
    await page.setContent(
      `<!doctype html><html><body style="margin:0;width:${W}px;height:${H}px;background:#fff;display:flex;align-items:center;justify-content:center">
       <img style="max-width:100%;max-height:100%;filter:grayscale(1)" src="data:image/svg+xml;base64,${b64}">
       </body></html>`,
      { waitUntil: 'networkidle' }
    );
    return await page.screenshot({ type: 'png' });
  } finally {
    await page.close();
  }
}

function decode(buf: Buffer): PNG {
  return PNG.sync.read(buf);
}

export async function runVisualDiff(only?: string): Promise<void> {
  if (!fs.existsSync(RESULTS_JSON)) throw new Error('results.json missing — run `diff` first');
  const results = JSON.parse(fs.readFileSync(RESULTS_JSON, 'utf-8')) as RunResults;
  const cfg = JSON.parse(fs.readFileSync(CONFIG_JSON, 'utf-8')) as Cfg;
  const filter = only ? new RegExp('^' + only.replace(/[.]/g, '\\.').replace(/\*/g, '.*') + '$') : null;

  const browser = await chromium.launch();
  let done = 0;
  try {
    for (const row of results.rows) {
      if (filter && !filter.test(row.id)) continue;
      const refPath = [path.join(REF_SVG_DIR, `${row.id}.svg`), path.join(OFFICIAL_SVG_DIR, `${row.id}.svg`)].find((p) =>
        fs.existsSync(p)
      );
      const ourPath = path.join(OURS_SVG_DIR, `${row.id}.svg`);
      if (!refPath || !fs.existsSync(ourPath)) continue;

      const [refPng, ourPng] = await Promise.all([
        renderSvgToPng(browser, fs.readFileSync(refPath, 'utf-8')).then(decode),
        renderSvgToPng(browser, fs.readFileSync(ourPath, 'utf-8')).then(decode),
      ]);

      const diff = new PNG({ width: W, height: H });
      const mismatch = pixelmatch(refPng.data, ourPng.data, diff.data, W, H, { threshold: 0.1 });

      // Whole-canvas ratio is near-zero for sparse line art; also report the
      // mismatch relative to the "inked" area (pixels dark on either side).
      let inked = 0;
      for (let i = 0; i < refPng.data.length; i += 4) {
        if (refPng.data[i] < 200 || ourPng.data[i] < 200) inked++;
      }
      const ratio = mismatch / Math.max(inked, 1);

      fs.mkdirSync(path.dirname(path.join(REPORT_DIR, `${row.id}.diff.png`)), { recursive: true });
      fs.writeFileSync(path.join(REPORT_DIR, `${row.id}.diff.png`), PNG.sync.write(diff));

      row.visualMismatch = ratio;
      row.visualWayOff = ratio >= cfg.visual.hardFailRatio;
      done++;
    }
  } finally {
    await browser.close();
  }

  fs.writeFileSync(RESULTS_JSON, JSON.stringify(results, null, 2) + '\n');
  console.log(`visual diff: ${done} pairs rendered → test-output/report/<id>.diff.png`);
}

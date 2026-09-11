# DEXPI conformance suite

Regression suite that compares the **Osiris DEXPI renderer / SVG export** against
a **pyDEXPI** reference render of the `samples/` corpus, so any change to the
renderer (or a newly added symbol) shows exactly where our output drifts from a
neutral third-party rendering.

Nothing here ships in the extension — it's a dev/CI tool, isolated in this folder
with its own `package.json`.

## One-time setup

```bash
# 1. Python reference renderer (into the repo-root .venv)
python3 -m venv ../../.venv
../../.venv/bin/pip install -r pydexpi/requirements.txt

# 2. Node deps + headless Chromium for the visual diff
npm install
npx playwright install chromium
```

## Run it

```bash
npm run conformance          # full pipeline → test-output/report/index.html
```

Open `test-output/report/index.html` (everything under `test-output/` is
gitignored). `summary.md` is the same data in Markdown; `results.json` is machine
readable.

### Stages (also runnable individually)

| command | does | output |
|---|---|---|
| `node test-output/.bin/cli.mjs corpus` | discover + classify `samples/**/*.xml` | `fixtures/corpus.json` |
| `… reference` | pyDEXPI reference SVGs (via `pydexpi/wrapper.py`) | `test-output/reference/` |
| `… ours` | headless Osiris SVG export | `test-output/ours/` |
| `… diff` | structural comparison (model-level) | `test-output/report/results.json` |
| `… visual` | headless-Chromium pixel diff (non-blocking) | `test-output/report/*.diff.png` |
| `… report` | HTML + Markdown report | `test-output/report/` |
| `… dump <id>` | print both extracted models for one file | stdout |
| `… baseline` | freeze current results as the CI baseline | `fixtures/baseline.json` |
| `… check-regression` | compare current run to the baseline (exit 1 on regression) | stdout |

`npm run conformance` runs corpus → reference → ours → diff → visual → report.
Add `-- --only "1.3/C0*"` to any command to filter by corpus id. Add
`-- --no-visual` to `run` to skip Chromium.

The `npm run …` scripts rebuild the bundled CLI (`build.mjs`, esbuild) first;
call `node test-output/.bin/cli.mjs <cmd>` directly to skip the rebuild.

## What "PASS" means

- **Structural (blocking):** same symbols (class + count), each within the
  position / rotation tolerance in `conformance.config.json`. `PASS` = no
  blocking finding, `WARN` = only size/label/style, `FAIL` = anything else.
- **Visual (non-blocking):** an ink-relative pixel-mismatch % and a heatmap PNG
  for human review. It never changes PASS/WARN/FAIL.

Frames are reconciled automatically: pyDEXPI renders native mm with DEXPI's
Y-up axis; our `projectToView` is Y-down and may be 3× scaled. The diff
normalises both and fits a scale+translate from equipment anchors before
matching.

## Adding a sample

Drop the `.xml` (PROTEUS) anywhere under `samples/`. It's auto-discovered on the
next run. Files with no drawing geometry (semantic-only DEXPI) are listed in
`corpus.json` but excluded from PASS/FAIL — there's nothing to render.

## CI

```bash
npm run conformance -- --no-visual
node test-output/.bin/cli.mjs check-regression   # exits 1 if any file regressed
```

Upload `test-output/report/` as a build artifact. Update `fixtures/baseline.json`
(via `… baseline`) in the same commit whenever a renderer fix legitimately moves
numbers.

## Known v1 limitations

See `TEST_PLAN.md` §11 and `AUDIT.md`. In short: connection comparison is
count-only and non-blocking; the reference symbol class comes from the pyDEXPI
shape name, not the conceptual model; the visual metric has no content-alignment
step. `pydexpi/PATCHES.md` documents the pyDEXPI input sanitisation.

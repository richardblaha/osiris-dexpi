# Reference renderings

Third-party SVG renderings of the `samples/*.dexpi` files, produced with the
[pyDEXPI](https://github.com/process-intelligence-research/pyDEXPI) toolkit
(`DrawDiagram`, A3 "pretty" mode). They render the Proteus **graphics** model
(ShapeCatalogue + drawing primitives) independently of the Osiris canvas, so
they can be used to sanity-check the editor's own layout and SVG export.

Regenerate:

```bash
python3 -m venv .venv
.venv/bin/pip install -r scripts/requirements.txt
.venv/bin/python scripts/render_reference_svgs.py
```

| Sample | Reference |
| :-- | :-- |
| `c01v04-ver.ex01.dexpi` | `c01v04-ver.ex01.svg` — official DEXPI "Example C01" P&ID |
| `simple-pid.dexpi` | *none* — bespoke Osiris fixture schema, carries no `<Drawing>` graphics for pyDEXPI to render |

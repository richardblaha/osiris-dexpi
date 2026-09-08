# Vendored P&ID stencils

The `*.xml` files in this directory are the Process & Instrumentation Diagram (P&ID)
stencils from **draw.io / diagrams.net**, used unmodified.

- Source: <https://github.com/jgraph/drawio> — `src/main/webapp/stencils/pid/`
- Commit: `201a90053406cd9773275b785e05cdcc626bdf1c` (default branch, fetched 2026-09-08)
- License: Apache License 2.0 — <https://github.com/jgraph/drawio/blob/dev/LICENSE>
- Copyright: © JGraph Ltd, © draw.io AG

These shape libraries follow the ISO 10628 / DIN 2429 / ISA-5.1 symbol conventions.
maxGraph loads them at runtime via `StencilShapeRegistry` (see `../registry.ts`).

`instruments.xml` from draw.io is **not** vendored here: its shapes bake the tag text
("FT", "PT", …) into the geometry, which clashes with the DEXPI tag name we render as
the cell label. ISA instrument bubbles are authored locally in `../local/instruments.xml`
without baked text.

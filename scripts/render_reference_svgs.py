#!/usr/bin/env python3
"""Render a reference SVG for every DEXPI sample using the pyDEXPI toolkit.

The output under ``samples/reference/`` is an independent rendering of the
Proteus *graphics* model (ShapeCatalogue + drawing primitives). Use it to
eyeball-check the Osiris canvas / SVG export against a neutral third party.

Only well-formed Proteus DEXPI files carry the graphical primitives pyDEXPI
needs; the bespoke Osiris fixture schema (e.g. ``simple-pid.dexpi``) has no
drawing data and is reported as skipped.

Usage
-----
    python3 -m venv .venv
    .venv/bin/pip install -r scripts/requirements.txt
    .venv/bin/python scripts/render_reference_svgs.py           # pretty (A3)
    .venv/bin/python scripts/render_reference_svgs.py --raw     # native coords
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SAMPLES_DIR = REPO_ROOT / "samples"
OUTPUT_DIR = SAMPLES_DIR / "reference"


def render(sample: Path, out_dir: Path, pretty: bool) -> tuple[str, str]:
    """Return ``(status, detail)`` for a single sample file."""
    from pydexpi.loaders.proteus_serializer import ProteusSerializer
    from pydexpi.loaders.svg_loader import DrawDiagram

    try:
        model = ProteusSerializer().load_from_string(sample.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001 - surface any loader failure verbatim
        return "skip", f"not loadable as Proteus DEXPI ({exc.__class__.__name__}: {exc})"

    if model.diagram is None:
        return "skip", "loaded, but carries no <Drawing> graphics to render"

    target = out_dir / f"{sample.stem}.svg"
    DrawDiagram(model.diagram, pretty=pretty).save_svg(sample.stem, str(target))
    return "ok", f"{target.relative_to(REPO_ROOT)} ({target.stat().st_size:,} bytes)"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--raw",
        action="store_true",
        help="keep native DEXPI coordinates / line widths instead of A3 'pretty' scaling",
    )
    args = parser.parse_args()

    samples = sorted(SAMPLES_DIR.glob("*.dexpi"))
    if not samples:
        print(f"No .dexpi files found in {SAMPLES_DIR}", file=sys.stderr)
        return 1

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    rendered = 0
    for sample in samples:
        status, detail = render(sample, OUTPUT_DIR, pretty=not args.raw)
        marker = {"ok": "✓", "skip": "–"}[status]
        print(f"  {marker} {sample.name}: {detail}")
        rendered += status == "ok"

    print(f"\n{rendered}/{len(samples)} sample(s) rendered into {OUTPUT_DIR.relative_to(REPO_ROOT)}/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

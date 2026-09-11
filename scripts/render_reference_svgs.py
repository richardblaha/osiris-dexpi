#!/usr/bin/env python3
"""Render a reference SVG + PNG for every DEXPI sample using the pyDEXPI toolkit.

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
    .venv/bin/python scripts/render_reference_svgs.py           # pretty (A3), svg+png
    .venv/bin/python scripts/render_reference_svgs.py --raw     # native coords
    .venv/bin/python scripts/render_reference_svgs.py --svg-only
"""

from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

_TZ_OFFSET_RE = re.compile(r"[+-]\d{2}:\d{2}$")

REPO_ROOT = Path(__file__).resolve().parent.parent
SAMPLES_DIR = REPO_ROOT / "samples"
OUTPUT_DIR = SAMPLES_DIR / "reference"


def normalize_plant_information(xml_text: str) -> str:
    """Fill in ``Application``/``ApplicationVersion`` on ``<PlantInformation>``.

    pyDEXPI 1.2.0's Proteus parser unconditionally slices
    ``PlantInformation/@ApplicationVersion`` (``ver[0:3]``) and crashes with a
    bare ``TypeError`` when the attribute is absent. Most real-world Proteus
    exports predate that DEXPI 1.3 attribute, so we default it (and its
    sibling ``Application``) before handing the document to the parser. This
    only ever *adds* missing attributes; every other check in the parser
    treats a mismatched value as a warning, not a hard failure.

    It also does ``float(i) for i in Time.split(":")`` with no timezone
    handling, so a Proteus-legal ``Time="14:36:53.0000000+02:00"`` blows up
    on the ``"53.0000000+02"`` chunk. We strip a trailing ``[+-]HH:MM``
    offset before parsing since the parser has nowhere to put it anyway.
    """
    root = ET.fromstring(xml_text)
    info = root.find("PlantInformation")
    if info is not None:
        info.attrib.setdefault("Application", "Dexpi")
        info.attrib.setdefault("ApplicationVersion", "1.3")
        time_value = info.attrib.get("Time")
        if time_value:
            info.attrib["Time"] = _TZ_OFFSET_RE.sub("", time_value)
    return ET.tostring(root, encoding="unicode")


def render(sample: Path, out_dir: Path, pretty: bool, want_png: bool, png_tool: str | None) -> tuple[str, str]:
    """Return ``(status, detail)`` for a single sample file."""
    from pydexpi.loaders.proteus_serializer import ProteusSerializer
    from pydexpi.loaders.svg_loader import DrawDiagram

    try:
        xml_text = normalize_plant_information(sample.read_text(encoding="utf-8"))
        model = ProteusSerializer().load_from_string(xml_text)
    except Exception as exc:  # noqa: BLE001 - surface any loader failure verbatim
        return "skip", f"not loadable as Proteus DEXPI ({exc.__class__.__name__}: {exc})"

    if model.diagram is None:
        return "skip", "loaded, but carries no <Drawing> graphics to render"

    svg_target = out_dir / f"{sample.stem}.svg"
    DrawDiagram(model.diagram, pretty=pretty).save_svg(sample.stem, str(svg_target))
    detail = f"{svg_target.relative_to(REPO_ROOT)} ({svg_target.stat().st_size:,} bytes)"

    if want_png:
        png_target = out_dir / f"{sample.stem}.png"
        try:
            if png_tool == "rsvg-convert":
                subprocess.run(
                    ["rsvg-convert", "--background-color=white", "-o", str(png_target), str(svg_target)],
                    check=True,
                    capture_output=True,
                    text=True,
                )
            elif png_tool == "inkscape":
                subprocess.run(
                    ["inkscape", str(svg_target), f"--export-filename={png_target}"],
                    check=True,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
            else:
                return "ok", detail + " (no SVG->PNG tool found; PNG skipped)"
        except subprocess.CalledProcessError as exc:
            reason = (exc.stderr or exc.stdout or str(exc)).strip().splitlines()[-1] if exc.stderr or exc.stdout else str(exc)
            return "ok", detail + f" (PNG rasterization failed: {reason})"
        detail += f", {png_target.relative_to(REPO_ROOT)} ({png_target.stat().st_size:,} bytes)"

    return "ok", detail


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--raw",
        action="store_true",
        help="keep native DEXPI coordinates / line widths instead of A3 'pretty' scaling",
    )
    parser.add_argument(
        "--svg-only",
        action="store_true",
        help="skip PNG rasterization, only emit SVG",
    )
    args = parser.parse_args()

    samples = sorted(SAMPLES_DIR.glob("*.xml")) + sorted(SAMPLES_DIR.glob("*.dexpi"))
    if not samples:
        print(f"No .xml/.dexpi files found in {SAMPLES_DIR}", file=sys.stderr)
        return 1

    want_png = not args.svg_only
    png_tool = None
    if want_png:
        if shutil.which("rsvg-convert"):
            png_tool = "rsvg-convert"
        elif shutil.which("inkscape"):
            png_tool = "inkscape"
        else:
            print("warning: neither rsvg-convert nor inkscape found; PNG output will be skipped", file=sys.stderr)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    rendered = 0
    skipped: list[tuple[str, str]] = []
    for sample in samples:
        status, detail = render(sample, OUTPUT_DIR, pretty=not args.raw, want_png=want_png, png_tool=png_tool)
        marker = {"ok": "✓", "skip": "–"}[status]
        print(f"  {marker} {sample.name}: {detail}")
        if status == "ok":
            rendered += 1
        else:
            skipped.append((sample.name, detail))

    print(f"\n{rendered}/{len(samples)} sample(s) rendered into {OUTPUT_DIR.relative_to(REPO_ROOT)}/")
    if skipped:
        print(f"{len(skipped)} sample(s) skipped:")
        for name, detail in skipped:
            print(f"  - {name}: {detail}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

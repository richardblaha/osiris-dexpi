#!/usr/bin/env python3
"""Thin, auditable wrapper around pyDEXPI 1.2.0 for reference-SVG generation.

pyDEXPI 1.2.0 (the latest PyPI release) crashes on a large fraction of the
official DEXPI example P&IDs before it ever gets to rendering, because its
Proteus parser assumes several ``<PlantInformation>`` attributes are present
and well-formed. None of those attributes affect the drawing. Rather than
monkey-patch the installed package, this wrapper **sanitises only the
``<PlantInformation>`` opening tag** of the input XML string and then calls
pyDEXPI's public API unchanged. Every edit is reported in the ``notes`` field
so it stays visible. See PATCHES.md.

Usage:
    python wrapper.py <input.xml> <output.svg> [--pretty]

Prints a single JSON object to stdout:
    {"status": "ok"|"unrenderable", "reason": "...", "notes": ["..."]}
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

# Defaults for missing metadata — chosen to satisfy pyDEXPI's format checks
# (ApplicationVersion "1.x", SchemaVersion "4.1", ISO-ish Date/Time) without
# implying anything real. They never reach the SVG.
_DEFAULT_APP_VERSION = "1.3"
_DEFAULT_SCHEMA_VERSION = "4.1.1"
_DEFAULT_DATE = "2000-01-01"
_DEFAULT_TIME = "00:00:00"


def _get_attr(tag: str, name: str) -> str | None:
    # tolerate `Name = "value"` (spaces around '=') as seen in some vendor exports
    m = re.search(rf'\b{name}\s*=\s*"([^"]*)"', tag)
    return m.group(1) if m else None


def _set_attr(tag: str, name: str, value: str) -> str:
    if re.search(rf'\b{name}\s*=\s*"', tag):
        return re.sub(rf'\b{name}\s*=\s*"[^"]*"', f'{name}="{value}"', tag, count=1)
    # insert before the closing '>' or '/>'
    if tag.rstrip().endswith("/>"):
        return re.sub(r"\s*/>\s*$", f' {name}="{value}"/>', tag)
    return re.sub(r"\s*>\s*$", f' {name}="{value}">', tag)


def sanitize(xml: str) -> tuple[str, list[str]]:
    """Return (possibly-fixed xml, notes describing each fix)."""
    notes: list[str] = []
    m = re.search(r"<PlantInformation\b[^>]*?/?>", xml)
    if not m:
        return xml, notes
    original = m.group(0)
    tag = original

    if _get_attr(tag, "ApplicationVersion") is None:
        tag = _set_attr(tag, "ApplicationVersion", _DEFAULT_APP_VERSION)
        notes.append(f'added ApplicationVersion="{_DEFAULT_APP_VERSION}" (was missing → parser TypeError)')

    if _get_attr(tag, "SchemaVersion") is None:
        tag = _set_attr(tag, "SchemaVersion", _DEFAULT_SCHEMA_VERSION)
        notes.append(f'added SchemaVersion="{_DEFAULT_SCHEMA_VERSION}" (was missing → parser TypeError)')

    if _get_attr(tag, "Date") is None:
        tag = _set_attr(tag, "Date", _DEFAULT_DATE)
        notes.append(f'added Date="{_DEFAULT_DATE}" (was missing → parser AttributeError)')

    raw_time = _get_attr(tag, "Time")
    if raw_time is None:
        tag = _set_attr(tag, "Time", _DEFAULT_TIME)
        notes.append(f'added Time="{_DEFAULT_TIME}" (was missing → parser AttributeError)')
    else:
        tm = re.match(r"(\d{1,2}):(\d{2}):(\d{2})", raw_time)
        norm = f"{tm.group(1)}:{tm.group(2)}:{tm.group(3)}" if tm else _DEFAULT_TIME
        if norm != raw_time:
            tag = _set_attr(tag, "Time", norm)
            notes.append(
                f"normalised Time {raw_time!r} → {norm!r} "
                "(pyDEXPI does float(x) on ':'-split parts; the timezone suffix "
                "'55.0000000+02:00' is not a float)"
            )

    if tag != original:
        xml = xml.replace(original, tag, 1)

    # pyDEXPI's graphical-primitive factory
    # (proteus_parser.parser_factory.ParserFactory.make_graphical_primitive_parsers)
    # recognises PolyLine/Polygon/Ellipse/Circle/EllipseArc/TrimmedCurve/ConnectorLine/
    # Text — but not the bare Proteus `<Line>` primitive (two Coordinate points,
    # same shape as PolyLine). Every <Line> inside a Shape/DrawingBorder/Label is
    # silently dropped, so straight edges vanish from otherwise-complete shapes.
    # <Line> has no attributes of its own in the corpus (verified), and a
    # PolylineParser reads its Presentation/Coordinate children generically
    # regardless of tag name, so renaming is safe and produces an identical object.
    n_lines = xml.count("<Line>")
    if n_lines:
        xml = xml.replace("<Line>", "<PolyLine>").replace("</Line>", "</PolyLine>")
        notes.append(f"renamed {n_lines}x <Line> -> <PolyLine> (pyDEXPI has no parser for the bare Line primitive)")

    return xml, notes


def render(in_path: Path, out_path: Path, pretty: bool) -> dict:
    from pydexpi.loaders.proteus_serializer import ProteusSerializer
    from pydexpi.loaders.svg_loader import DrawDiagram

    xml, notes = sanitize(in_path.read_text(encoding="utf-8"))

    try:
        model = ProteusSerializer().load_from_string(xml)
    except Exception as exc:  # noqa: BLE001 — surface any loader failure verbatim
        return {
            "status": "unrenderable",
            "reason": f"{exc.__class__.__name__}: {exc}",
            "notes": notes,
        }

    if getattr(model, "diagram", None) is None:
        return {
            "status": "unrenderable",
            "reason": "model loaded but carries no <Drawing> graphics",
            "notes": notes,
        }

    out_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        DrawDiagram(model.diagram, pretty=pretty).save_svg(in_path.stem, str(out_path))
    except Exception as exc:  # noqa: BLE001
        return {
            "status": "unrenderable",
            "reason": f"render failed — {exc.__class__.__name__}: {exc}",
            "notes": notes,
        }

    return {
        "status": "ok",
        "reason": "",
        "notes": notes,
        "bytes": out_path.stat().st_size,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("input")
    ap.add_argument("output")
    ap.add_argument(
        "--pretty",
        action="store_true",
        help="A3 'pretty' scaling + thin lines (default: raw native mm coordinates)",
    )
    args = ap.parse_args()

    result = render(Path(args.input), Path(args.output), pretty=args.pretty)
    json.dump(result, sys.stdout)
    sys.stdout.write("\n")
    return 0 if result["status"] == "ok" else 1


if __name__ == "__main__":
    raise SystemExit(main())

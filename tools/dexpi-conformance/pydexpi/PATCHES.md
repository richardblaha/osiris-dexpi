# pyDEXPI deviations used by the conformance wrapper

`wrapper.py` does **not** modify the installed `pydexpi` package. It sanitises
the input XML string (only the `<PlantInformation>` opening tag) before calling
pyDEXPI's public API (`ProteusSerializer().load_from_string` +
`DrawDiagram(...).save_svg`). Every edit is reported in the wrapper's `notes`
output and surfaced in the conformance report.

Tested against **pyDEXPI 1.2.0** (latest PyPI release as of 2026-09).

## Why the sanitisation is needed

All four issues are in `ProteusParser.compositional_pass()`
(`pydexpi/loaders/proteus_serializer/proteus_parser/parser_modules.py`, ~line 8040–8070).
None of the affected attributes influence the rendered drawing.

| # | pyDEXPI code | Fails when | Symptom | Wrapper fix |
|---|---|---|---|---|
| 1 | `if ver[0:3] != "1.3":` where `ver = plant_info.get("ApplicationVersion")` | attribute absent | `TypeError: 'NoneType' object is not subscriptable` — aborts the whole load | inject `ApplicationVersion="1.3"` if missing |
| 2 | `if sch_ver[0:3] != "4.1":` | `SchemaVersion` absent | same `TypeError` | inject `SchemaVersion="4.1.1"` if missing |
| 3 | `tuple(int(i) for i in plant_info.get("Date").split("-"))` | `Date` absent | `AttributeError: 'NoneType' object has no attribute 'split'` | inject `Date="2000-01-01"` if missing |
| 4 | `tuple(float(i) for i in plant_info.get("Time").split(":"))` | `Time` absent, **or** value carries a timezone / sub-second suffix, e.g. `11:42:55.0000000+02:00` | `ValueError: could not convert string to float: '55.0000000+02'` | if missing → `Time="00:00:00"`; else keep only the leading `HH:MM:SS` |

Issues 1 and 2 also emit a spurious `WARNING` for files that *do* carry a valid
value in a different form; that warning is harmless and ignored.

| # | pyDEXPI code | Fails when | Symptom | Wrapper fix |
|---|---|---|---|---|
| 5 | `ParserFactory.make_graphical_primitive_parsers` (`parser_factory.py`) only maps tags `PolyLine, Polygon, Ellipse, Circle, EllipseArc, TrimmedCurve, ConnectorLine, Text` | a `Shape`/`DrawingBorder`/`Label` contains a bare `<Line>` primitive (two `<Coordinate>` points — same shape as `PolyLine`, just a different Proteus tag) | the `<Line>` is silently dropped — no error, the primitive just never appears, so shapes render with missing edges or (when a shape is *only* lines) not at all | rename `<Line>`/`</Line>` → `<PolyLine>`/`</PolyLine>` in the input text. `<Line>` carries no attributes in the corpus (verified) and `PolylineParser` reads its `Presentation`/`Coordinate` children generically regardless of tag name, so the renamed element parses into an identical `PolyLine` object. |

This one is the highest-impact fix: it moved the "geometry-rich" reference count
from 14/220 to 62/220 (files whose shapes are drawn mostly with straight lines —
most valves and fittings — were otherwise reported as near-empty).

## Genuine source-file defects (NOT worked around)

- Some 1.3 example files (`C02`, `C03`, …) use `Attribute = "value"` with spaces
  around `=`. That is legal XML; the wrapper's attribute regex tolerates it.
- Files with `status: "unrenderable", reason: "... no <Drawing> graphics"` are
  semantic-only DEXPI models (no coordinates). There is no reference geometry to
  produce — they are excluded from the corpus by design, not by a bug.

## Upstream

These should be reported to https://gitlab.com/dexpi/pyDEXPI. Until fixed
upstream, keep this wrapper; when a release fixes them, delete the matching
sanitisation branch and bump `requirements.txt`.

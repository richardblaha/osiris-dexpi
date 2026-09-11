#!/usr/bin/env python3
"""Dump a pyDEXPI-class map for one Proteus XML: every diagram
RepresentationGroup id -> the DEXPI class + tag of the conceptual-model object
it represents.

The reference SVG (svg_loader.DrawSVG) serialises each RepresentationGroup as
``<g id="{group.id}" class="representation-group">`` — the SAME id used here —
so the conformance suite's SVG walker can join a rendered `<g>` straight back
to a real DEXPI class (Python class names in pyDEXPI mirror the Proteus
`ComponentClass` string, e.g. `CentrifugalPump`, `PlugValve`, `PipeTee`)
instead of guessing from the drawn shape's name.

Usage:
    python model_dump.py <input.xml> <output.json>

Output: {"groups": {"<representationGroupId>": {"class": "...", "tag": "..."}}}
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from wrapper import sanitize  # noqa: E402


def build_concept_map(model) -> dict[str, tuple[str, str | None]]:
    """proteusId -> (python class name, best-effort tag) for every taggable object."""
    idmap: dict[str, tuple[str, str | None]] = {}
    cm = model.conceptualModel

    def put(obj, tag=None):
        pid = getattr(obj, "proteusId", None)
        if pid:
            idmap[pid] = (type(obj).__name__, tag)

    for tpi in cm.taggedPlantItems:
        put(tpi, getattr(tpi, "tagName", None))
        for noz in getattr(tpi, "nozzles", None) or []:
            put(noz, getattr(noz, "subTagName", None))
        for chamber in getattr(tpi, "chambers", None) or []:
            put(chamber)
    for pns in cm.pipingNetworkSystems:
        for seg in pns.segments:
            put(seg)
            for item in seg.items:
                put(item, getattr(item, "tagName", None))
    for pif in cm.processInstrumentationFunctions:
        put(pif)
    for act in cm.actuatingSystems:
        put(act)
    return idmap


def walk_groups(groups, concept_map, out) -> None:
    """Populate `out[key]` for every RepresentationGroup, keyed by
    ``represents.id`` — the SAME value ``svg_loader.DrawSVG`` writes as the
    rendered ``<g id="...">`` (see ``group.set("id", self.group.represents.id)``
    in ``pydexpi/loaders/svg_loader.py``). It is **not** `RepresentationGroup.id`
    and not `proteusId`. This only works when walked against the identical
    `model` object that was rendered — pydantic's default `id` factory mints a
    fresh UUID on every parse, so two separate `load_from_string()` calls on the
    same XML do NOT share ids.
    """
    for g in groups or []:
        if type(g).__name__ == "RepresentationGroup":
            represents = getattr(g, "represents", None)
            rid = getattr(represents, "id", None) if represents else None
            pid = getattr(represents, "proteusId", None) if represents else None
            hit = concept_map.get(pid) if pid else None
            if hit and rid:
                out[str(rid)] = {"class": hit[0], "tag": hit[1]}
        sub = getattr(g, "groups", None)
        if sub:
            walk_groups(sub, concept_map, out)


def classmap_for_model(model) -> dict[str, dict]:
    """`{svg <g id>: {class, tag}}` for a single, already-loaded model. Must be
    called on the exact `model` instance that will be (or was) rendered —
    see the note on `walk_groups`."""
    out: dict[str, dict] = {}
    if model.diagram is not None:
        concept_map = build_concept_map(model)
        walk_groups(model.diagram.groups, concept_map, out)
    return out


def main() -> int:
    # Standalone CLI use (debugging only) — the conformance pipeline calls
    # classmap_for_model() from wrapper.py on the same model it renders, since
    # ids are not stable across separate load_from_string() calls.
    if len(sys.argv) != 3:
        print("usage: model_dump.py <input.xml> <output.json>", file=sys.stderr)
        return 2

    from pydexpi.loaders.proteus_serializer import ProteusSerializer

    xml, _ = sanitize(Path(sys.argv[1]).read_text(encoding="utf-8"))
    model = ProteusSerializer().load_from_string(xml)
    out = classmap_for_model(model)

    Path(sys.argv[2]).write_text(json.dumps({"groups": out}, indent=2), encoding="utf-8")
    print(json.dumps({"status": "ok", "groups": len(out)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

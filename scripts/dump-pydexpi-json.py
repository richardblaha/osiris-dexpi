#!/usr/bin/env python3
"""Dump pyDEXPI JSON envelope representation of c01v04-ver.ex01.dexpi as oracle."""

import json
from pathlib import Path
from pydexpi.loaders.proteus_serializer import ProteusSerializer
from pydexpi.loaders.json_serializer import JsonSerializer

REPO_ROOT = Path(__file__).resolve().parent.parent
SAMPLE_FILE = REPO_ROOT / "samples" / "c01v04-ver.ex01.dexpi"
OUT_FILE = REPO_ROOT / "samples" / "reference" / "c01.pydexpi.json"

def main() -> None:
    text = SAMPLE_FILE.read_text(encoding="utf-8")
    model = ProteusSerializer().load_from_string(text)
    envelope = JsonSerializer().model_to_dict(model)
    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_FILE, "w", encoding="utf-8") as f:
        json.dump(envelope, f, indent=2, ensure_ascii=False)
    print(f"Wrote oracle: {OUT_FILE} ({OUT_FILE.stat().st_size:,} bytes)")

if __name__ == "__main__":
    main()


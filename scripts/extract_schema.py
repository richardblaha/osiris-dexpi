#!/usr/bin/env python3
"""Extract pyDEXPI class hierarchy, fields, enums, and URIs for TypeScript generation."""

import importlib
import inspect
from enum import Enum
import json
from pathlib import Path
from typing import get_args, get_origin

import pydexpi
from pydexpi.dexpi_classes import dexpiBaseModels, pydantic_classes

REPO_ROOT = Path(__file__).resolve().parent.parent

MODULES = [
    'dexpiModel', 'metaData', 'plantStructure', 'equipment', 'piping',
    'instrumentation', 'customization', 'physicalQuantities', 'dataTypes', 'enumerations', 'graphics'
]

def clean_type_name(t) -> str:
    if t is None:
        return 'unknown'
    if hasattr(t, '__forward_arg__'):
        return t.__forward_arg__.replace(' | None', '').strip()
    if isinstance(t, type):
        return t.__name__
    s = str(t)
    if 'ForwardRef(' in s:
        s = s.replace("ForwardRef('", "").replace("')", "")
    s = s.replace('pydexpi.dexpi_classes.pydantic_classes.', '')
    s = s.replace('pydexpi.dexpi_classes.dataTypes.', '')
    s = s.replace('pydexpi.dexpi_classes.enumerations.', '')
    s = s.replace('pydexpi.dexpi_classes.physicalQuantities.', '')
    s = s.replace('pydexpi.dexpi_classes.customization.', '')
    s = s.replace(' | None', '')
    s = s.replace('None | ', '')
    return s.strip()

def main() -> None:
    data = {
        'uris': {},
        'classes': {},
        'enums': {},
        'physicalQuantities': {},
    }

    # 1. Enums
    enum_mod = importlib.import_module('pydexpi.dexpi_classes.enumerations')
    for name, cls in inspect.getmembers(enum_mod, inspect.isclass):
        if issubclass(cls, Enum):
            data['enums'][name] = [item.name for item in cls]

    # 2. Classes across modules
    for mod_name in MODULES:
        mod = importlib.import_module(f'pydexpi.dexpi_classes.{mod_name}')
        for name, cls in inspect.getmembers(mod, inspect.isclass):
            if not issubclass(cls, (dexpiBaseModels.DexpiBaseModel, dexpiBaseModels.DexpiDataTypeBaseModel)):
                continue
            if name in data['classes']:
                continue

            uri = getattr(cls, 'uri', None)
            if uri:
                data['uris'][name] = uri

            # Physical quantities
            if mod_name == 'physicalQuantities':
                unit_field = cls.model_fields.get('unit')
                unit_enum = getattr(unit_field, 'annotation', None) if unit_field else None
                units = []
                if unit_enum and issubclass(unit_enum, Enum):
                    units = [item.name for item in unit_enum]
                data['physicalQuantities'][name] = {
                    'uri': uri,
                    'units': units
                }

            # Inspect fields
            fields_meta = {}
            for f_name, f_info in cls.model_fields.items():
                cat = f_info.json_schema_extra.get('attribute_category') if f_info.json_schema_extra else None
                annotation = f_info.annotation
                is_list = False
                origin = get_origin(annotation)
                if origin is list:
                    is_list = True
                    args = get_args(annotation)
                    elem_type = args[0] if args else None
                else:
                    elem_type = annotation
                
                type_name = clean_type_name(elem_type)

                fields_meta[f_name] = {
                    'category': cat,
                    'isList': is_list,
                    'required': f_info.is_required(),
                    'type': type_name
                }

            # Check direct bases
            direct_bases = [
                b.__name__ for b in cls.__bases__
                if issubclass(b, (dexpiBaseModels.DexpiBaseModel, dexpiBaseModels.DexpiDataTypeBaseModel))
                and b not in (dexpiBaseModels.DexpiBaseModel, dexpiBaseModels.DexpiDataTypeBaseModel, dexpiBaseModels.DexpiSingletonBaseModel)
            ]

            data['classes'][name] = {
                'module': mod_name,
                'uri': uri,
                'isBaseModel': issubclass(cls, dexpiBaseModels.DexpiBaseModel),
                'bases': direct_bases,
                'fields': fields_meta,
            }

    out_file = REPO_ROOT / 'scripts' / 'pydexpi-schema.json'
    with open(out_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"Extracted {len(data['classes'])} classes, {len(data['enums'])} enums -> {out_file}")

if __name__ == '__main__':
    main()


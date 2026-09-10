# DEXPI Conformance – Fáze 0 Audit

Datum: 2026-09-10 · Stav: **průzkum hotový, čekám na rozhodnutí (viz „Otevřené otázky")**

Cíl fáze 0: zmapovat vstupy (`resources/`, `samples/`), renderovací pipeline editoru,
možnosti pyDEXPI a pokrytí symbolů. Žádné velké změny kódu.

---

## 1. `resources/` – inventář a formát

`resources/` **neobsahuje** strojově čitelné per-symbol definice DEXPI komponent.
Je to sbírka referenčních / normativních materiálů:

| Cesta | Obsah | Formát | Poznámka |
|---|---|---|---|
| `resources/symbols/ISO_10628-2_2012_Symbols_Sheet_1..7.svg` | 7 listů norem­ních symbolů ISO 10628-2:2012 | 1 velký SVG / list, stovky `<path>` + `<text>` pohromadě, **není** rozřezané na jednotlivé symboly | ~440 elementů/list, symboly nemají `id` ani skupiny podle typu |
| `resources/symbols/ISO_10628-2_2012_Symbols.pdf` | tytéž listy | PDF | |
| `resources/symbols/PID_Symbol_Library_Complete_Reference.md` | 383řádkový přehled ISA 5.1 / ISO 10628-2 / odkazy na open-source knihovny a datasety | Markdown, tabulky | orientační dokument, ne katalog |
| `resources/symbols/BK-2020-04-master/` | ukázkový „chemical plant drawing standards" projekt (BK-2020-04) – kompletní sada výkresů PID-1 / TMP-1 rozdělená do 22 ISO skupin | `DWG/*.svg` (plné listy), `DEL/*_plain.svg`, PDF, `REF/*.org` s tabulkou skupin | opět celé listy, ne jednotlivé symboly; `REF/ISO_10628-2_2012_en..symbol_groups.org` = seznam 22 skupin a počtů symbolů |
| `resources/dexpi/Specification-V2.0.0/` | oficiální DEXPI „Specificator" – zdroj informačního modelu | `src/model/**/*.py` (definice tříd), `src/documentation/_static/DEXPI_XML_Schema.xsd`, `builds/PDF/DEXPI_PID_Specification_1.4.pdf` (46 MB) | informační model + XSD, **žádná geometrie symbolů**; `src/model/Core/Diagram/*` popisuje jen primitiva (Ellipse, EllipseArc, DashStyles) |

**Závěr:** „symboly v `resources/`" = normativní obrázkové listy (ISO 10628-2, BK-2020-04)
a informační model (DEXPI spec). Skutečná kreslicí geometrie, kterou editor používá,
**není** v `resources/`, ale ve vendorovaných draw.io stencilech
(`src/maxgraph/stencils/vendor/*.xml`, mxGraph stencil schema – viz paměť
`pid-symbol-library-source`). → **Otázka #1.**

Počet symbolů v editorové sadě (stencily): 254 `<shape>` ve `vendor/` + 5 v `local/instruments.xml`.

---

## 2. `samples/` – inventář

Adresář byl kompletně přestrukturován (pracovní strom, **necommitnuto**):
staré `samples/*.dexpi` + `samples/reference/` smazané, přidány oficiální
DEXPI „example pids" repozitáře pro 1.2 a 1.3.

```
samples/dexpi 1.2/example pids/   – ~40 podsložek (E01–E14, I01–I15, P01–P04, C01–C08)
samples/dexpi 1.3/example pids/   – 41 podsložek (stejné schéma)
```

- **203 `.xml`** souborů celkem (PROTEUS XML, přípona `.xml`, ne `.dexpi`).
- Mnoho souborů na jednu úlohu = varianty od různých nástrojů/dodavatelů
  (`-AUD`, `-SAG`, `-ING`, `-VTT`, `-HEX`, `-AVV`, `-VER`, `.EX01..EX04`).
- Pomocné soubory: `.pptx`, `.png`, `.pdf`, `.html`, `_issues.txt`.

### Grafický obsah (klíčové zjištění)

| Kategorie | Počet XML | Renderovatelné pyDEXPI? |
|---|---|---|
| Nese Proteus kreslicí primitiva (`<Position>`, `<Extent>`, `ShapeCatalogue`, `PolyLine`) | ~161 s `<Position>`, 130 s `ShapeCatalogue` | pouze část – viz níže |
| **Sémanticky-only** (1.3 `E*/I*/P*` „…VER.EX01" – jen `<Equipment>`/`<ProcessInstrumentationFunction>`, žádné souřadnice) | 33 | **NE** – neexistuje žádná geometrická „pravda" |
| Oficiální referenční `.svg` přiložený v repu | **5** (`C01V04-VER.EX01.svg`, `C01V01-HEX.EX02(-VTT).svg`, `C02V03-VER.EX02.svg`, `C03V04-VER.EX02.svg`) | – |

---

## 3. Renderovací pipeline editoru + SVG export

```
PROTEUS XML
  └─ ProteusReader.read(xml)          src/model/proteus/reader/index.ts   (fast-xml-parser, běží v Node ✔)
       └─ DexpiModel                  src/model/classes/*
            └─ projectToView(model)   src/model/view/projection.ts        (čistá funkce, běží v Node ✔)
                 └─ PidView { nodes[], edges[], labels[], bounds }
                      ├─ WebGPU render (webgpuCanvas.ts → engine.ts)      – jen v prohlížeči
                      └─ exportPidViewToSvg(view)  src/webview/exportSvg.ts
```

- `projectToView` čte geometrii **z Proteus modelu**: `eq.position.location`,
  `eq.extent`, rotaci/mirror, Y-flip (DEXPI Y-up mm → canvas Y-down). Pro
  sémanticky-only soubory jsou pozice `?? 100` (fallback, žádný layout engine).
- `exportPidViewToSvg(view)` je **čistá funkce** `PidView → string`. Kreslí stencil
  geometrii přes `DOMParser`; když `DOMParser` chybí (Node), spadne na
  `renderFallbackGeometry` (parametrická náhrada – kruh/obdélník/trojúhelník).
  → pro headless běh je nutný shim (`@xmldom/xmldom` nebo `linkedom`).
- **Vstup do editoru:** custom editor `osiris.dexpiEditor`, binduje `*.dexpi`.
  Samples mají příponu `.xml` → dnes se v editoru neotevřou jako Design
  (jen jako text). → **Otázka #5.**
- **SVG export dnes:** command `osiris-dexpi.exportSvg` → webview pošle
  `svgExported` → `dexpiEditorProvider.saveSvg` otevře „Save as" dialog.
  Není headless, ale podkladová funkce `exportPidViewToSvg` ano.
- **Headless pipeline je proveditelná** bez webview: `ProteusReader.read` →
  `projectToView` → `exportPidViewToSvg` (+ DOMParser shim), spustitelné přes
  `tsx`/esbuild. Nezávisí na WebGPU.

---

## 4. pyDEXPI – verze a možnosti

- Nainstalováno v `.venv` (Python 3.14): **pyDEXPI 1.2.0** – na PyPI je to
  **nejnovější** vydání (dostupné: 1.0.0, 1.1.0, 1.2.0).
- SVG cesta: `ProteusSerializer().load_from_string(xml)` → `model.diagram` →
  `DrawDiagram(model.diagram, pretty=…).save_svg(name, path)`
  (`pydexpi/loaders/svg_loader.py`, třída `SvgRenderer`).
  - Renderuje **Proteus graphics model** (ShapeCatalogue + PolyLine/Polygon/
    Ellipse/EllipseArc/Text/ConnectorLine), **ne** sémantický model.
  - `pretty=True` → škáluje na A3 (420×297 mm) a ztenčuje čáry 0.3×.
    `--raw` → nativní souřadnice.
- **Blokující omezení pyDEXPI 1.2.0** (testováno na všech 203 XML):
  | Problém | Dopad | Řešitelnost |
  |---|---|---|
  | `parser_modules.py:8044` `ver[0:3]` když `ApplicationVersion` chybí → `TypeError` | ~167 souborů spadne | trivální (guard `(ver or "")`), workaroundem lze zachránit ~76 souborů |
  | `could not convert string to float: '55.0000000+02'` (Fortran exponent bez `E`) | ~40 souborů | oprava ve wrapperu (regex `(\d)\+(\d\d)` → `\1E+\2`) |
  | `xml.etree ParseError` (C02, C03 1.3) | 2 soubory | nutná analýza (asi nevalidní entity/namespace) |
  | `model.diagram is None` – soubor bez kreslicích primitiv | 33+ souborů | **neřešitelné** – v souboru není geometrie |
- **Výsledek bez oprav:** renderovatelné **3 / 203**
  (`C01V04-VER.EX01`, `C02V03-VER.EX02`, `C03V04-VER.EX02` – ty 2 posledně přes jinou cestu).
- **Výsledek s drobným wrapperem** (guard + float fix): odhadem **~80 / 203**
  (většina „dexpi 1.2" dodavatelských exportů + `C01` 1.3).
- pyDEXPI **neumí** vyrenderovat sémantický model bez geometrie – pro
  sémanticky-only 1.3 soubory neexistuje žádná reference (ani od pyDEXPI, ani jinde).

---

## 5. Matice pokrytí symbolů (editor vs. samples)

Editorový katalog (`src/maxgraph/stencils/catalog.ts`): 91 položek → **57 unikátních
`componentClass`**. Mapování `catalogStencilFor()` dělá **přesnou shodu řetězce**
`componentClass`; při neshodě → `DEFAULT_STENCILS` (tank / gate valve / discrete bubble).

DEXPI `ComponentClass` hodnoty vyskytující se v `samples/` (jen kreslené prvky,
bez struktur jako `Label`, `Nozzle`, `PipingNetworkSegment`):

| DEXPI třída (výskytů) | V katalogu? | Poznámka |
|---|---|---|
| `Tank` (84) | ❌ | katalog má `StorageTank` → padá na default |
| `CentrifugalPump` (52) | ✅ | |
| `PlugValve` (43) | ❌ | |
| `ShutOffValve` (36) | ❌ | generická „uzavírací" armatura |
| `PlateAndShellHeatExchanger` (36) | ❌ | katalog má `PlateHeatExchanger` |
| `BlindFlange` (36) | ❌ | katalog má `SpectacleBlind` / `PipeCap` |
| `Pump` (30) | ❌ | generická |
| `BallValve` (30) | ✅ | |
| `ButterflyValve` (25) | ✅ | |
| `HeatExchanger` (22) | ❌ | generický |
| `PipeReducer` (17) | ❌ | katalog má `Reducer` |
| `Vessel` (16) | ❌ | katalog má `Vertical/HorizontalVessel` |
| `SpringLoadedAngleGlobeSafetyValve` / `SpringLoadedGlobeSafetyValve` / `AngleSafetyValve` (16) | ❌ | katalog má `SafetyReliefValve` |
| `GlobeValve` (12) | ✅ | |
| `TightShutOffValve` (10) | ❌ | |
| `ReciprocatingPump` (9) | ❌ | katalog má `PositiveDisplacementPump` |
| `PlateHeatExchanger` (9) | ✅ | |
| `ShellAndTubeHeatExchanger` (7) | ✅ | |
| `ControlValve` (6) | ✅ | |
| `GateValve` (5) | ✅ | |
| `SwingCheckValve` (5) / `CheckValve` (2) | ❌/✅ | |
| `VenturiTube` (4) | ✅ | |
| `ProcessColumn` (2) | ❌ | katalog má `DistillationColumn` |
| `PressureVessel` (1) | ❌ | |
| `RestrictionOrifice` (1) | ❌ | katalog má `OrificePlate` |
| Instrumenty: `ProcessInstrumentationFunction` (143), `MeasurementFunction*`, `ActuatingSystem` (47) | ⚠️ | editor je odvozuje ze sémantického modelu; `dexpiClass` u nich = `ProcessInstrumentationFunction` → default bublina |

**Hrubý závěr matice:** z ~25 kreslených tříd v samples katalog přesně trefí **~9**;
zbytek padá na default stencil. Hlavní problém **není chybějící geometrie** (stencilů
je 254), ale **mapování `componentClass` → stencil** (názvosloví katalogu neodpovídá
DEXPI RDL názvům z reálných souborů). Plná matice symbol×Y/N bude generovaná
nástrojem ve fázi 2.

---

## 6. Ostatní zjištění

- `.venv/` není v `.gitignore` (ani trackovaný). `test-output/` zatím neexistuje.
- `resources/` + `samples/` jsou z velké části trackované (`git ls-files` = 885),
  ale aktuální přestrukturování `samples/` je v pracovním stromu **necommitnuté**
  (smazané staré `.dexpi`, přidané `dexpi 1.2/`, `dexpi 1.3/`).
- Existující testy (`test/proteus.*.test.ts`) už používají pyDEXPI JSON oracle
  (`scripts/dump-pydexpi-json.py`) – precedens pro pyDEXPI jako „pravdu" na
  úrovni **modelu**, ne renderu.
- `scripts/render_reference_svgs.py` počítá se starým layoutem `samples/*.dexpi` →
  po přestrukturování **nefunguje** (0 souborů najde).

---

## Otevřené otázky (STOP – potřebuji rozhodnutí, než půjdu do fáze 1)

**#1 – Co je „všechny symboly v `resources/`"?**
V `resources/` nejsou per-symbol definice. Máš na mysli:
 (a) každý symbol nakreslený na listech ISO 10628-2 (nutno je ručně katalogizovat z SVG/PDF),
 (b) DEXPI RDL třídy, které se reálně vyskytují v `samples/` (praktický, měřitelný cíl),
 (c) něco jiného (např. konkrétní podmnožina BK-2020-04)?

**#2 – Testovací korpus.** Které soubory jsou cílem konformní sady?
 (a) jen soubory s Proteus geometrií renderovatelné pyDEXPI (~80, hlavně „dexpi 1.2"),
 (b) + 5 oficiálních `.svg` jako druhá reference,
 (c) i sémanticky-only 1.3 `E*/I*/P*` (33) – ty ale nemají geometrickou pravdu,
     šlo by jen strukturálně porovnat náš výstup s obsahem sémantického modelu,
 (d) jen kanonické `C0x` reference PID.

**#3 – pyDEXPI 1.2.0 vyžaduje lokální patche**, aby vyrenderovala víc než 3 soubory
(guard na `ApplicationVersion`, oprava Fortran exponentů, C02/C03 ParseError).
OK vendorovat tenký patchovací wrapper kolem pyDEXPI v `tools/dexpi-conformance/`?
Nebo se omezit jen na to, co pyDEXPI zvládne „as-is" (3 soubory)?

**#4 – Definice „100% shody".** Náš renderer (sémantický model + draw.io stencily +
dopočítaný layout) a pyDEXPI (syrové Proteus polylinie) jsou **jiné renderovací
modely** – pixel-identita není dosažitelná. Potvrzuješ cíl =
 strukturální parita (tytéž symboly/třídy/pozice v toleranci + tatáž konektivita)
 + vizuální „dost blízko" s heatmapou, **ne** pixel-perfect?

**#5 – Necommitnuté přestrukturování `samples/` + přípona.**
 (a) Mám nejdřív commitnout současný stav `samples/` jako baseline (a přidat
     `.venv/`, `test-output/` do `.gitignore`)?
 (b) Samples mají `.xml`, editor binduje `.dexpi`. Headless pipeline to obejde,
     ale pro ruční kontrolu v editoru: přejmenovat/kopírovat na `.dexpi`, nebo
     rozšířit binding editoru na `.xml`?

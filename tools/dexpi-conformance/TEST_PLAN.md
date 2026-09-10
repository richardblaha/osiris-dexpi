# DEXPI Conformance – Fáze 1: Návrh regresní test suite

Stav: **návrh k odsouhlasení** (implementace až po potvrzení).
Vychází z rozhodnutí k `AUDIT.md`:

| # | Rozhodnutí |
|---|---|
| Rozsah symbolů | **celá sada ISO 10628-2:2012** (296 symbolů / 29 skupin) – vlastní matice pokrytí, nezávislá na korpusu |
| Testovací korpus | **~80 souborů s Proteus geometrií** + 5 oficiálních `.svg`; sémanticky-only 1.3 mimo |
| pyDEXPI | **vendorovaný patchovací wrapper** v `tools/dexpi-conformance/pydexpi/` |
| Definice shody | **strukturální parita + vizuální „blízko"**; heatmapa je pro člověka, neblokuje |

---

## 1. Adresářová struktura

```
tools/dexpi-conformance/
  AUDIT.md  TEST_PLAN.md  README.md
  conformance.config.json      # tolerance, prahy, cesty – vše dokumentované
  pydexpi/
    wrapper.py                 # patched loader + render (CLI)
    requirements.txt           # pyDEXPI==1.2.0
    PATCHES.md                 # každá odchylka od upstreamu + odkaz na issue
  src/
    corpus.ts                  # objeví + klasifikuje samples/**/*.xml
    render-reference.ts        # -> test-output/reference/<id>.svg (přes wrapper.py)
    render-ours.ts             # ProteusReader -> projectToView -> exportPidViewToSvg
    model-extract.ts           # DEXPI model (obě strany) -> normalizovaný DiagramModel
    structural-diff.ts         # DiagramModel x DiagramModel -> Finding[]
    visual-diff.ts             # svg -> png (resvg) -> normalizace -> pixelmatch -> heatmapa
    report.ts                  # index.html + summary.md + results.json
    symbol-matrix.ts           # pokrytí ISO 10628-2 (samostatné)
    cli.ts                     # jediný vstupní bod
  fixtures/
    iso10628-2-catalog.json    # index 296 symbolů (stavěný inkrementálně)
    corpus.json                # generovaný manifest korpusu (commitnutý)
    baseline.json              # commitnutý baseline pro detekci regresí
  test-output/                 # .gitignore – reference/, ours/, report/, *.png
```

Nová `package.json` závislosti (dev): `tsx`, `@xmldom/xmldom`, `@resvg/resvg-js`,
`pixelmatch`, `pngjs`. Python: samostatný `.venv` (už existuje).

---

## 2. Definice korpusu (`corpus.ts` → `fixtures/corpus.json`)

1. Projde `samples/**/*.xml`.
2. Každý soubor klasifikuje:
   - `proteus-graphics` – nese `<Position>` + `ShapeCatalogue`/`PolyLine` **a** projde
     wrapperem pyDEXPI s `diagram != None`;
   - `semantic-only` – načte se, ale bez geometrie (mimo korpus, jen evidence);
   - `unrenderable` – parser/float chyba i po patchi (mimo korpus, evidováno).
3. **Korpus = množina `proteus-graphics`** (odhad ~80).
4. Stabilní ID = `<verze>/<úloha>/<slug souboru>`, např.
   `1.2/E01/e01v01-aud-ex01`. Manifest: ID, cesta, verze, kód úlohy, klasifikace,
   přítomnost oficiálního `.svg`, poznámky.
5. `corpus.json` se **commituje** – změna korpusu je viditelná v diffu.

---

## 3. Generování referencí (`pydexpi/wrapper.py` + `render-reference.ts`)

`wrapper.py` (CLI: `python wrapper.py <in.xml> <out.svg> [--raw]`):

1. **Pre-processing textu** před parsováním:
   - doplní `ApplicationVersion="…"` do `<PlantInformation>`, pokud chybí
     (příčina `TypeError` na `parser_modules.py:8044`);
   - regex `(?<=\d)\+(?=\d\d\b)` → `E+` (Fortran exponent `55.0000000+02`).
2. `ProteusSerializer().load_from_string(...)` → při `ParseError` vrátí status
   `unrenderable` s důvodem (nefabrikuje výstup).
3. `DrawDiagram(model.diagram, pretty=False).save_svg(...)` – **native mm souřadnice**
   (`pretty=False`), aby šly zarovnat s naším výstupem (projekce také pracuje v mm).
4. `render-reference.ts` volá wrapper na celý korpus → `test-output/reference/<id>.svg`
   + `reference-manifest.json` (status + důvod per soubor).
5. `PATCHES.md` = přesný seznam odchylek od pyDEXPI 1.2.0 + odkaz na upstream issue
   (bug reportneme). Wrapper **nemění** nainstalovaný balík – jen pre-processing +
   volání veřejného API; případný monkeypatch je v jednom místě a okomentovaný.
6. Kde existuje oficiální `.svg` (5×), zkopíruje se jako `reference-official/<id>.svg`
   (druhá, autoritativnější reference pro vizuální kontrolu).

---

## 4. Generování našeho výstupu (`render-ours.ts`)

Headless, přes `tsx`, bez WebGPU/webview:

```
globalThis.DOMParser = require('@xmldom/xmldom').DOMParser   // aby fungovala stencil geometrie
ProteusReader.read(xml)  ->  DexpiModel
projectToView(model)     ->  PidView
exportPidViewToSvg(view, { theme: 'light', includeBackground: false })  ->  test-output/ours/<id>.svg
```

Tím se testuje **reálný kód editoru** (`src/model/proteus`, `src/model/view`,
`src/webview/exportSvg`) → regrese rendereru se chytí. Výstup je v mm, stejná osa jako
`--raw` reference.

---

## 5. Strukturální porovnání (`model-extract.ts` + `structural-diff.ts`)

**Zdroj pravdy = parsované modely, ne struktura SVG.** SVG obou stran je strukturně
nesrovnatelné (draw.io stencily vs. Proteus polylinie), proto se porovnává normalizovaná
reprezentace získaná z modelů:

`DiagramModel` (společný tvar pro obě strany):
```
symbols[]:     { id, dexpiClass, kind, cx, cy, w, h, rotation, mirrored, tag }
connections[]: { id, kind: 'pipe'|'signal', fromSymbol, toSymbol, fromPort?, toPort?, polyline[] }
labels[]:      { text, x, y, ownerId? }
bbox:          { minX, minY, maxX, maxY }
```

- **Naše strana:** přímo z `PidView` (`projectToView`).
- **Referenční strana:** z pyDEXPI modelu
  (`ProteusSerializer` → `model.conceptual_model` + `model.diagram`): třídy a pozice
  z Proteus `Equipment`/`PipingComponent`/`ShapeReference`, konektivita z
  `PipingNetworkSegment` uzlů. (Pomocný Python skript `model-dump.py` → JSON, který
  TS strana načte – analogie k existujícímu `scripts/dump-pydexpi-json.py`.)

`structural-diff.ts` porovná a vygeneruje `Finding[]` s kategoriemi (severity ↓):

| Kategorie | Popis | Práh |
|---|---|---|
| `symbol-missing` | v referenci je, u nás chybí | – |
| `symbol-extra` | u nás navíc | – |
| `symbol-class-mismatch` | jiná `dexpiClass` / použit default stencil | – |
| `position-off` | posun těžiště | `> tol.positionMm` (výchozí 2 mm) **nebo** `> tol.positionPct` (5 % úhlopříčky) |
| `size-off` | jiné w/h | `> 15 %` |
| `rotation-mismatch` | jiná rotace/mirror | `> 1°` / bool |
| `connection-missing` / `connection-extra` | hrana symbol–symbol | – |
| `label-mismatch` | chybějící/jiný tag text | – |
| `style-diff` | jen tloušťka čáry, šipky, barva | informativní |

Tolerance v `conformance.config.json`, každá s komentářem proč.
**PASS** = žádný `symbol-*`, `connection-*`, `position-off`, `rotation-mismatch`.
**WARN** = jen `size-off` / `label-mismatch` / `style-diff`.
**FAIL** = cokoli závažnějšího.

---

## 6. Vizuální porovnání (`visual-diff.ts`) – neblokující

1. SVG → PNG přes `@resvg/resvg-js` (deterministické, bez prohlížeče), pevné DPI.
2. Normalizace před diffem: společný viewBox (sjednocení bbox obou), stejná velikost
   plátna, bílé pozadí, náš výstup převeden na monochrom (černá na bílé) aby odpovídal
   neutrální referenci.
3. `pixelmatch` → `test-output/report/<id>.diff.png` (heatmapa) + `mismatchRatio`.
4. Reportuje se jako číslo + náhled. Práh `visual.hardFail` (výchozí 0.25) jen označí
   „vizuálně úplně mimo" – jinak nemá vliv na PASS/FAIL (to řídí strukturální diff).

---

## 7. Report (`report.ts`)

- `test-output/report/index.html` – řádek per soubor korpusu: status chip
  (PASS/WARN/FAIL), strukturální skóre, vizuální `mismatch %`, tři náhledy
  (reference | ours | heatmapa), rozbalitelný seznam `Finding` s odkazem na
  `sourcePath` v modelu.
- `test-output/report/summary.md` – souhrnná tabulka + agregace:
  „nejčastější nálezy napříč korpusem" (např. `symbol-class-mismatch: Tank ×41`).
- `test-output/report/results.json` – strojové, pro CI a porovnání s baseline.

---

## 8. Matice pokrytí symbolů ISO 10628-2 (`symbol-matrix.ts`) – samostatné

Nezávislé na korpusu (korpus testuje jen ~25 tříd, cíl je 296 symbolů).

1. `fixtures/iso10628-2-catalog.json` – index 296 symbolů:
   `{ group, groupName, number, name, sheet, gridCell, aliases[], dexpiRdlClass? }`.
   Stavěno **inkrementálně po skupinách**; seed z:
   - taxonomie 29 skupin (`BK-2020-04-master/REF/…symbol_groups.org`),
   - `resources/symbols/PID_Symbol_Library_Complete_Reference.md`,
   - názvy symbolů z listů ISO / spec PDF 1.4.
2. `symbol-matrix.ts` pro každý symbol zjistí: existuje stencil? vyrenderuje se
   neprázdný thumbnail? na kterou DEXPI RDL třídu je namapován (`catalogStencilFor`)?
   → `test-output/report/symbol-matrix.{md,html}` (thumbnaily, Y/N, poznámka).
3. Zvlášť příkaz `npm run symbol-matrix`.

---

## 9. Test runner a CI

| Příkaz | Co dělá |
|---|---|
| `npm run conformance` | celá pipeline: reference → ours → diffy → report |
| `npm run conformance -- --only "C01*"` | filtr na podmnožinu (rychlost ve fázi 3) |
| `npm run conformance -- --update-baseline` | zapíše `fixtures/baseline.json` |
| `npm run symbol-matrix` | jen matice pokrytí ISO |

- **Přidání sample:** soubor do `samples/…`, znovu spustit – auto-discovery.
- **CI** (GitHub Actions): job s Python+Node, `npm run conformance`, nahraje
  `test-output/report/` jako artefakt. **Faily na regresi vůči commitnutému
  `baseline.json`**, ne na absolutní FAIL (baseline startuje většinově FAIL).
- `test/conformance.test.ts` (vitest) – tenký strážce: „žádná regrese vůči baseline".

---

## 10. Priorita oprav ve fázi 3

Řazení podle `(počet dotčených souborů korpusu × váha závažnosti)`:

1. **Nenamapovaná třída → default stencil** – zdaleka nejvíc souborů; oprava =
   rozšířit `catalogStencilFor` / přidat alias tabulku DEXPI RDL → stencil
   (`Tank`→tank, `PipeReducer`→reducer, `PlugValve`→…, `ShutOffValve`→…). Nejvyšší ROI.
2. **Chybějící geometrie** – třída namapovaná, ale stencil chybí/nevhodný → doplnit
   z draw.io sady nebo nakreslit dle ISO 10628-2.
3. **Špatná pozice / měřítko** – chyby projekce (parsování `<Extent>`, Y-flip,
   umístění nozzle).
4. **Špatná rotace / mirror.**
5. **Chybějící spoje** – routing `PipingNetworkSegment`.
6. **Umístění popisků / textu.**
7. **Čistě stylové** (tloušťka, šipky) – nejnižší.

Po každé sadě oprav: aktualizace matice pokrytí + changelog (`tools/dexpi-conformance/CHANGELOG.md`:
co opraveno, dopad na PASS count / průměrné strukturální skóre).

---

## 11. Dílčí rozhodnutí – vyřešeno

1. **Strukturální pravda = parsované modely** (náš `PidView` vs pyDEXPI model),
   ne struktura referenčního SVG. ✅
2. **PNG engine = Playwright (headless Chromium)** – vizuálně věrné webview editoru.
   Přidá se dev závislost `playwright` (+ `npx playwright install chromium` v CI). ✅
3. **`samples/` se commitne teď** jako baseline; `.gitignore` dostane `.venv/` a
   `tools/dexpi-conformance/test-output/`. ✅
4. **`.xml` zůstává**, headless pipeline to řeší; binding editoru se nemění
   (samostatný úkol). ✅
5. **ISO katalog:** fáze 2 = první průchod „namapuj ~57 tříd katalogu ↔ ISO skupiny
   + gap list"; plný index 296 symbolů se doplňuje inkrementálně ve fázi 3.
   (výchozí volba dle plánu – lze změnit)

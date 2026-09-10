# P&ID Symbol Library & Drafting Protocols
## Complete Reference Document

**Standards Covered:** ISA 5.1 | ISO 10628-2 | ISO 14617 | PIP PIC001  
**Compiled:** March 2026

---

## Table of Contents

1. [P&ID Overview & Base Material](#pid-overview--base-material)
2. [ISA 5.1 Standard Symbol Library](#isa-51-standard-symbol-library)
3. [Open-Source SVG Symbol Libraries](#open-source-svg-symbol-libraries)
4. [Drafting Protocols](#drafting-protocols)
   - [Line Designation](#line-designation)
   - [Tag Name Drafting](#tag-name-drafting)
   - [Line Types & Signal Conventions](#line-types--signal-conventions)
5. [Protocol Documents & Standards (Free PDF)](#protocol-documents--standards-free-pdf)
6. [AI/ML Datasets for Symbol Detection](#aiml-datasets-for-symbol-detection)
7. [Quick Start - Which Library to Use?](#quick-start---which-library-to-use)
8. [Drafting Best Practices](#drafting-best-practices)

---

## P&ID Overview & Base Material

A **Piping and Instrumentation Diagram (P&ID)** is a detailed schematic showing the piping, instrumentation, and control systems of a process plant. It is the primary engineering document for:
- Process safety analysis (HAZOP, LOPA)
- Construction and installation
- Operations and maintenance
- Regulatory compliance

### What Makes Up a P&ID?

| Component | Description |
|-----------|-------------|
| **Symbol Library** | Standardized graphical symbols (ISA 5.1 / ISO 10628-2) representing instruments, valves, pumps, tanks, and line types |
| **Tag Name System** | Alphanumeric codes (e.g., FIC-101) that uniquely identify each instrument and loop |
| **Line Designation** | Rules for labeling process lines with fluid type, size, material class, insulation |
| **Engineering Protocols** | Standards (ISA 5.1, ISO 10628-2, PIP PIC001) governing symbols, tags, and line drawing |

**Key Standards:**
- **ANSI/ISA-5.1** (USA/International)
- **ISO 10628-2** (International)
- **ISO 14617** (Graphical symbols)
- **DIN 28004** (German/European)
- **PIP PIC001** (Process Industry Practices)

---

## ISA 5.1 Standard Symbol Library

### Core Geometric Symbols

| Symbol Shape | Meaning | Typical Use |
|--------------|---------|-------------|
| **Circle** | Discrete instrument (sensor, transmitter, indicator, recorder) | Most field-mounted instruments |
| **Circle + Square** | Shared control/display (common indicator for multiple loops) | Central annunciators, panel displays |
| **Hexagon** | Computer function (software logic, DCS/PLC algorithm) | Control-system function blocks |
| **Triangle inside Square** | Programmable Logic Controller (PLC) function | PLC ladder-logic or function blocks |
| **Diamond** | Primary element (sensor in direct contact with process) | Orifice plates, thermowells |

### Instrument Location Modifiers

| Line Type | Location | Example |
|-----------|----------|----------|
| No line | Field-mounted | FT-101 (no bar) |
| Single horizontal bar | Primary location (control room panel) | FIC-101 (single bar) |
| Double horizontal bar | Auxiliary location (secondary panel) | FRC-101 (double bar) |
| Dashed line | Behind panel (not accessible) | FY-101 (dashed bar) |

### First Letter – Measured Variable

- **A** = Analysis (pH, O2, conductivity)
- **B** = Burner / Combustion
- **C** = Conductivity
- **D** = Density / Specific Gravity
- **E** = Voltage
- **F** = Flow
- **G** = Gauging / Position
- **H** = Hand (manual operation)
- **I** = Current (electrical)
- **J** = Power
- **K** = Time / Schedule
- **L** = Level
- **M** = Moisture / Humidity
- **N** = User-defined
- **O** = User-defined
- **P** = Pressure / Vacuum
- **Q** = Quantity / Event
- **R** = Radiation / Radioactivity
- **S** = Speed / Frequency / RPM
- **T** = Temperature
- **U** = Multivariable
- **V** = Vibration / Mechanical Analysis
- **W** = Weight / Force
- **X** = Unclassified
- **Y** = Event / State / Presence
- **Z** = Position / Dimension

### Second & Subsequent Letters – Device Function

- **C** = Controller
- **E** = Primary Element (sensor)
- **I** = Indicator
- **R** = Recorder
- **S** = Switch
- **T** = Transmitter
- **V** = Control Valve
- **Y** = Relay / Compute / Convert
- **A** = Alarm
- **H** = High
- **L** = Low
- **HH** = High-High
- **LL** = Low-Low
- **G** = Glass / Gauge / Sight Glass
- **K** = Control Station
- **Q** = Integrator / Totalizer
- **W** = Well / Thermowell
- **X** = Unclassified Accessory

### Common Tag Examples

| Tag | Full Meaning | Typical Application |
|-----|--------------|---------------------|
| **FT-101** | Flow Transmitter, Loop 101 | Sends flow signal to DCS |
| **FIC-101** | Flow Indicator Controller, Loop 101 | Panel-mounted flow control loop |
| **TT-201** | Temperature Transmitter, Loop 201 | RTD/thermocouple transmitter |
| **PIC-301** | Pressure Indicator Controller, Loop 301 | Pressure control loop |
| **LSH-401** | Level Switch High, Loop 401 | High-level alarm/shutdown switch |
| **FCV-101** | Flow Control Valve, Loop 101 | Automated control valve |
| **PSV-501** | Pressure Safety Valve, Loop 501 | Pressure relief / safety valve |
| **AIT-601** | Analysis Indicator Transmitter, Loop 601 | Analyzer transmitter (pH, O2, etc.) |

---

## Open-Source SVG Symbol Libraries

### 1. FreeCAD-Symbols (GitHub)
- **Repository:** https://github.com/FreeCAD/FreeCAD-symbols
- **Contents:**
  - `compass roses/` - compass and orientation SVG symbols
  - `projection symbols/` - first/third angle projection SVG symbols
  - `section marks/` - cross-section line SVG markers
  - `SymbolsLibrary.FCMacro` - Python macro to load all SVGs into FreeCAD
- **License:** CC-BY 3.0
- **Format:** SVG files
- **Download:** `git clone https://github.com/FreeCAD/FreeCAD-symbols` OR Click Code > Download ZIP

### 2. Wikimedia Commons P&ID SVG Symbols (81 files)
- **URL:** https://commons.wikimedia.org/wiki/Category:P%26ID_symbols
- **Symbol Groups:**
  - Instrument functions (9 files): Discrete instrument (field/control room/local panel), Computer function, Control function
  - ISO 10628-2 Sheets (7 complete sheets): Sheet 1-7 in SVG + PDF (each 2980×2105 px)
  - Tanks & containers (36 files): P&ID 301.svg, P&ID 2061.svg, etc.
  - Pipes (15+ files): Concentric piping reducer, Cooled/heated pipe, Flexible pipe
  - Valves (15 files): Back draft damper + 14 more
  - Actuators: Actuator (diaphragm) (DIN 2429), etc.
- **License:** Mostly Public Domain or CC-BY-SA
- **Download:** Click each SVG → right-click → Save As SVG

### 3. Capital X Panel Designer (SVG + DXF + DWG)
- **URL:** https://symbols.radicasoftware.com/category/pid
- **Contents:** 3-Way Ball Valve, 4-Way Valve, Angle Globe Valve, Ball Valve NC/NO, Agitator/Mixer, and many more valves/instruments
- **Standards:** Both ISO and PIP standard variants available
- **Formats:** SVG, PNG, JPG, DXF, DWG
- **License:** Free for use with attribution
- **Download:** Click any symbol → Click "SVG" button → direct download

### 4. Draw.io / Diagrams.net - PID XML Stencils (SVG-backed)
| Stencil File | GitHub URL |
|--------------|------------|
| valves.xml | https://github.com/vmassol/draw.io/blob/master/war/stencils/pid/valves.xml |
| pumps.xml | https://github.com/vmassol/draw.io/blob/master/war/stencils/pid/pumps.xml |
| engines.xml | https://github.com/igniterealtime/DrawIO/blob/master/classes/draw/stencils/pid/engines.xml |
| heat_exchangers.xml | https://github.com/vmassol/draw.io/blob/master/war/stencils/pid/heat_exchangers.xml |

**Usage:** Import XML file into draw.io via **File → Open Library from URL**, or copy individual `<shape>` snippets and paste via **Arrange → Insert → Shape**

### 5. SpaceTeam/pnid-lib - KiCad Library (GPL-3.0)
- **Repository:** https://github.com/SpaceTeam/pnid-lib
- **Files:**
  - `PnID.kicad_sym` (KiCad 6+)
  - `PnID.lib` (KiCad 5 legacy)
- **Contents:** Valves, servos, orifices, rockets, voltmeters, 3-way valves
- **License:** GPL-3.0
- **Usage:** Add `PnID.kicad_sym` to your KiCad symbol library path

### 6. PIDcircuitTikZ - LaTeX/TikZ ISO 14617 Symbols
- **Repository:** https://github.com/jellespijker/PIDcircuitTikZ
- **Standard:** ISO 14617 P&ID symbols
- **Contents:** Full LaTeX/TikZ library: piping, instruments, actuators, controllers
- **License:** Open Source (LPPL)
- **Usage:** Place .tex files in same folder or in `<TEXMFHOME>/tex/latex/PIDcircuitTikz/`

---

## Drafting Protocols

### Line Designation (Pipe Tags)

Each piping line is labeled with a **line number** (or "line tag") that uniquely identifies it:

**Format:** `[Size]-[Fluid Code]-[Material Class]-[Insulation]-[Line Sequence]`

**Example:** `4-CS-1501-I-A`
- 4 = 4-inch NPS
- CS = Cold Service
- 1501 = Material Class 1501 (Carbon Steel, Schedule 40)
- I = Insulated
- A = Line A (sequence)

| Component | Meaning | Example |
|-----------|---------|----------|
| **Size** | Pipe nominal diameter (inches or mm) | 4 (= 4 inches NPS) |
| **Fluid Code** | Type of fluid or service (CS, HS, etc.) | CS |
| **Material Class** | Piping material class per spec | 1501 |
| **Insulation** | Insulation type (I = insulated, blank = bare) | I |
| **Line Sequence** | Unique sequential letter/number | A |

### Tag Name Drafting (Instrument Tags)

ISA 5.1 defines a systematic approach:

1. **First Letter:** Measured or initiating variable (F, T, P, L, etc.)
2. **Subsequent Letters:** Device functions (I, T, C, V, etc.)
3. **Loop Number:** Unique numeric identifier (001, 101, 201, etc.)
4. **Optional Suffix:** A, B, C (for parallel/redundant); 1, 2, 3 (for sub-loops)

**Example:** `FIC-101A` = Flow Indicator Controller, Loop 101, Device A

| Tag Scheme | Numbering Convention | Example |
|------------|----------------------|----------|
| Sequential numbering | 001, 002, 003... | FT-001, FT-002, FT-003 |
| Line-based numbering | Loop tied to line number | FT-1501, TIC-1501 |
| Area/unit-based numbering | First digit = area code | FT-101, TIC-201 (Area 2) |

### Line Types & Signal Conventions

| Line Type | ISA 5.1 Convention | Represents |
|-----------|--------------------|-----------|
| **Solid line** | ─────── | Process piping (liquid, gas, steam) |
| **Dashed line** | - - - - - | Electrical signal or pneumatic control signal |
| **Dotted line** | · · · · · | Hydraulic or pneumatic power supply |
| **Dash-dot line** | -·-·-·-· | Data/communication link (fieldbus, Ethernet) |
| **Double line** | ═══════ | Major equipment envelope (not standardized) |

**Signal Direction:** Arrows show direction of signal flow (transmitter → DCS, controller → valve).

---

## Protocol Documents & Standards (Free PDF)

| Standard/Document | Year | Free Access URL |
|-------------------|------|------------------|
| **ANSI/ISA-5.1-2009**<br>Instrumentation Symbols and Identification | 2009 | http://ftp.demec.ufpr.br/disciplinas/TMEC166/Prof.Leandro_Novak/2019_2/ISA%20CODIFICA%C7%C3O%202009.pdf |
| **ANSI/ISA-5.1-2022**<br>Instrumentation Symbols (Latest) | 2022 | https://pdfcoffee.com/ansiisa-51-2022-5-pdf-free.html |
| **ISO 10628-2:2012 Symbol Sheets**<br>Seven complete sheets (SVG + PDF) | 2012 | https://commons.wikimedia.org/wiki/Category:P%26ID_symbols |
| **EdrawMax P&ID Symbols PDF**<br>Standard Symbols Legend | 2023 | https://images.edrawmax.com/symbols/p-and-id-symbols/pid-symbols-pdf.pdf |
| **Edrawsoft P&ID Symbols Legend**<br>ISA-standardized symbols | 2023 | https://www.edrawsoft.com/pid/images/pid-legend.pdf |
| **ProjectMaterials P&ID Symbols List**<br>407 symbols per ISA S5.1 & ISO 14617 | 2026 | https://blog.projectmaterials.com/epc-projects/engineering/pid-symbols-list/ |
| **Easson P&ID Symbols Legend**<br>Comprehensive legend (email signup) | 2023 | https://eassoncontrolandautomation.co.uk/pandid |

**Note:** ISA-5.1-2022 is the most current official version. The 2009 version remains widely used and referenced.

---

## AI/ML Datasets for Symbol Detection

| Repository | Description | Stars/Forks | URL |
|------------|-------------|-------------|------|
| **ch-hristov/p-id-symbols** | YOLOv5 dataset of labeled P&ID symbol images | 44 ⭐ / 21 forks | https://github.com/ch-hristov/p-id-symbols |
| **planttalk/pid-symbol-studio** | SVG symbol classification tooling + augmented PNG generation | — | https://github.com/planttalk/pid-symbol-studio |
| **aneeshbhattacharya/Automated-PnID** | Full detection + labeling pipeline | — | https://github.com/aneeshbhattacharya/Automated-PnID-Symbol-Detection-and-Labelling |
| **Kaggle P&ID dataset** | 21-fork dataset from ch-hristov project | — | https://www.kaggle.com/datasets/hristohristov21/pid-symbols |

---

## Quick Start - Which Library to Use?

| Your Tool | Best Library to Start With |
|-----------|----------------------------|
| **FreeCAD** | FreeCAD/FreeCAD-symbols (clone + run FCMacro) |
| **draw.io / Diagrams.net** | vmassol/draw.io stencils (valves.xml, pumps.xml, etc.) - already built-in as "Proc. Eng." shapes |
| **Inkscape** | Wikimedia Commons SVGs (download individually or bulk via API) |
| **KiCad** | SpaceTeam/pnid-lib (add PnID.kicad_sym to symbol library) |
| **LaTeX** | PIDcircuitTikZ (ISO 14617 compliant) |
| **Any tool** | Capital X Panel Designer (direct SVG download per symbol) |

---

## Drafting Best Practices

### 1. Symbol Library Setup
- Develop a project-specific symbol library early
- Reference client or PIP PIC001 documentation criteria
- Maintain a legend that matches the CAD drafting symbology used throughout the P&ID set
- Use ISA 5.1 tables (A.1–A.4) for letter meanings and line-symbol table when creating the diagram key

### 2. Tag Naming Conventions
- Be consistent with loop numbering scheme across the project
- Document your tag numbering system in a project specification
- Reserve number ranges for different areas/units (e.g., 100s = Area 1, 200s = Area 2)
- Use suffixes (A, B, C) for parallel or redundant instruments
- Total tag length should not exceed 16 characters (typical limit in DCS systems)

### 3. Line Designation Best Practices
- Create a line list/line register that documents all line numbers
- Assign line numbers early in design (even during PFD stage)
- Keep line numbers consistent between drawings
- Update line list when piping changes occur
- Include line list as a separate document deliverable

### 4. Drawing Standards
- Follow client-specific P&ID standards if provided
- If no client standard exists, use PIP PIC001 as a baseline
- Include a "General Notes" block that cites ISA 5.1 as the governing standard
- Use consistent line weights: thick for process piping, medium for signals, thin for non-process
- Maintain clear spacing between symbols (minimum 10mm)
- Align symbols on a grid for clean appearance

### 5. Signal Line Conventions
- Always show signal direction with arrows
- Use dashed lines for electronic/pneumatic signals
- Label signal lines with cable/tubing tag if required by client
- Show signal interconnections clearly (avoid crossing lines where possible)

### 6. Documentation
- Maintain an instrument index (list of all tags with description and location)
- Create instrument datasheets for all control devices
- Keep a revision history on every P&ID sheet
- Use "cloud" markup to show areas of change between revisions

### 7. Quality Checks
- Verify all instrument tags are unique
- Check that all signals have a source and destination
- Ensure all valves have a tag or are marked as "untagged"
- Confirm line numbers match the line list
- Validate that all symbols match the project legend

---

## Additional Resources

### Online Communities
- **r/ProcessEngineering** (Reddit) - P&ID discussions and examples
- **Eng-Tips Forums** - Instrumentation & Control section
- **LinkedIn Groups:** "Piping and Instrumentation Diagrams (P&ID)", "Process Engineers"

### Training & Tutorials
- **ISA Training:** https://www.isa.org/training-and-certification/isa-courses
- **Udemy P&ID Courses:** Search "P&ID" or "Piping Instrumentation"
- **YouTube Channels:** "The Engineering Mindset", "Control Global"

### Books
- *ISA-5.1 Standard & Technical Reports* (Official ISA Publications)
- *P&ID Symbols and Notation* by Norman P. Lieberman
- *Piping and Instrumentation Diagram Development* by Moe Toghraei

---

## Contributing

If you find additional open-source P&ID symbol libraries or protocol documents, please contribute by:
1. Opening an issue or pull request on this Gist
2. Sharing with the community on r/ProcessEngineering
3. Emailing suggestions to P&ID standards committees

---

## License

This reference document is released under **CC0 1.0 Universal (Public Domain)**.

All linked symbol libraries and standards retain their original licenses (CC-BY, GPL, LPPL, etc.) as specified in each section.

---

**Compiled by:** Anonymous Engineer  
**Date:** March 18, 2026  
**Version:** 1.0

**Disclaimer:** This is an educational reference document. Always follow your organization's specific P&ID standards and client requirements. When in doubt, consult with a licensed professional engineer.
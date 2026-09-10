# Osiris DEXPI P&ID Editor (`osiris-dexpi`)

First-class VS Code extension for DEXPI P&ID (Piping and Instrumentation Diagram) files (`.dexpi`).

The extension provides dual-mode editing (interactive maxGraph visual canvas and raw XML), real-time bidirectional synchronization, dark/light theme alignment, a professional ISO 10628 / ISA-5.1 P&ID symbol library, and an embedded **Model Context Protocol (MCP)** server for programmatic inspection and mutation by LLM agents.

---

## Key Features

- **DEXPI ISO 15926 Conformance & Lossless SerDes**:
  - Strongly typed domain model aligned with pyDEXPI / Proteus XML SchemaVersion 4.1.1.
  - Complete round-trip fidelity preserving XML attributes, hierarchical equipment/nozzle structures, centerline routing, drawing borders, shape catalogues, and unmodeled XML passthrough.
- **Interactive Visual Canvas (`@maxgraph/core`)**:
  - Hardware-accelerated SVG diagram canvas with move + connect editing, smooth panning (right-drag, or left-drag on empty canvas), grid snapping, and orthogonal pipe routing. Technical symbols are not resizable and labels track the DEXPI tag.
  - Interactive port docking: pipelines dock directly to equipment nozzles (`Inlet`, `Outlet`).
  - Scales to large schematics: an RBush spatial index drives viewport culling and a scale-based level-of-detail system (ports/labels/shadows drop out as you zoom out).
- **Design & Source, switched natively**:
  - **Design**: a distraction-free, near-100 %-canvas visual editor. Zoom with `Ctrl`/`⌘` + scroll or the floating overlay, fit with `Ctrl`/`⌘` + `0`, toggle the grid with `G`. The overlay corner is configurable (`top-right` default).
  - **Source**: the standard VS Code text editor with XML syntax highlighting and schema validation.
  - Switch between them with VS Code's own editor-type toggle (the **Open Source (XML)** / **Open with DEXPI Design Editor** title-bar button, or `View: Reopen Editor With…`). Put them side by side with a normal editor split.
- **"P&ID" panel** (Activity Bar):
  - **P&ID Symbols** — the professional symbol palette; click a symbol to drop it on the active diagram.
  - **Properties** — DEXPI attribute inspector for the selected element.
- **Professional P&ID symbol library**:
  - ISO 10628 / DIN 2429 / ISA-5.1 vector symbols from the Apache-2.0 [draw.io](https://github.com/jgraph/drawio) P&ID stencil set, loaded via maxGraph's `StencilShapeRegistry` — the **same drawing** renders in the palette and on the canvas.
  - Theme-aware monochrome rendering (black-on-white / white-on-dark); the Osiris cyan accent is reserved for selection and hover.
  - ISA-5.1 instrument bubbles are authored locally (no baked tag text — the DEXPI tag name is the label).
  - Coverage: pumps & compressors, vessels, tanks & columns, reactors, heat exchangers, ~17 valve types, fittings & in-line piping, flow elements, and instrument bubbles (field / shared-display / computer / logic).
- **Embedded MCP Server (`osiris-dexpi-mcp`)**:
  - Embeds standard Model Context Protocol (MCP) server tools for LLM agents.
  - **Live Buffer Synchronization**: Mutates the active VS Code `TextDocument` buffer via extension IPC with undo/redo stack preserved.
  - **Headless CLI Mode**: Operates on disk files for automation and CI/CD pipelines.

---

## Extension Architecture

```
osiris-dexpi/
├── src/
│   ├── extension.ts               # Extension activator, provider registration, IPC bridge
│   ├── common/
│   │   ├── types.ts               # Common types, IPC protocol contracts
│   │   └── constants.ts           # Command IDs, view types, Osiris theme tokens
│   ├── model/                     # Strong DEXPI TypeScript Data Model & Proteus XML SerDes
│   │   ├── classes/               # Auto-generated DEXPI domain model classes
│   │   ├── proteus/               # Multi-pass Proteus XML reader & writer
│   │   │   ├── reader/            # Multi-pass Proteus XML parser
│   │   │   └── writer/            # Format-preserving Proteus XML serializer
│   │   ├── view/                  # Visual projection (PID view) and bidirectional apply
│   │   ├── validator.ts           # Schema & topological validation
│   │   ├── service.ts             # Unified DexpiModelService (shared by MCP & VS Code)
│   │   ├── envelope.ts            # pyDEXPI JSON envelope serializer/deserializer
│   │   └── index.ts
│   ├── editor/                    # VS Code CustomTextEditorProvider
│   │   ├── dexpiEditorProvider.ts  # CustomTextEditorProvider implementation (canvas-only webview)
│   │   ├── syncManager.ts         # Bi-directional sync coordinator with change debouncing
│   │   └── editorHub.ts           # Bridge between the active editor and the "P&ID" panel views
│   ├── maxgraph/                  # maxGraph Visual Canvas Integration
│   │   ├── adapter.ts             # DEXPI <-> maxGraph cell graph model mapper
│   │   ├── stencils/              # Professional P&ID symbol library
│   │   │   ├── vendor/*.xml       # draw.io P&ID stencils (Apache-2.0) — see vendor/NOTICE.md
│   │   │   ├── local/instruments.xml  # locally authored ISA-5.1 instrument bubbles
│   │   │   ├── sources.ts         # stencil id scheme + raw <shape> XML index
│   │   │   ├── registry.ts        # registers every stencil with StencilShapeRegistry
│   │   │   ├── catalog.ts         # curated palette + DEXPI class -> stencil mapping
│   │   │   └── thumbnail.ts       # stencil -> inline SVG for palette previews
│   │   ├── styles.ts              # theme-aware monochrome P&ID stylesheet
│   │   └── index.ts
│   ├── webview/                   # Design canvas webview (100 % canvas)
│   │   ├── index.ts               # Webview entry point
│   │   ├── canvas.ts              # maxGraph canvas: move/pan/connect config, grid, zoom, selection
│   │   ├── overlay.ts             # configurable floating control panel (zoom + grid toggle)
│   │   ├── perf/                  # large-schematic performance
│   │   │   ├── spatialIndex.ts    # RBush spatial index over every top-level cell
│   │   │   ├── viewportCulling.ts # hides off-screen cells (display:none), edge-retention rule
│   │   │   └── lod.ts             # scale → level-of-detail class on the root <svg>
│   │   ├── theme.ts               # CSS variables & dynamic theme observer
│   │   └── webview.css            # canvas + overlay + LOD styling
│   ├── panel/                     # "P&ID" Activity Bar panel
│   │   ├── pidViews.ts            # SymbolsViewProvider + PropertiesViewProvider
│   │   ├── index.ts               # panel webview bundle (symbol palette + properties form)
│   │   └── panel.css
│   └── mcp/                       # Built-in MCP Server (osiris-dexpi-mcp)
│       ├── server.ts              # MCP Server definition (@modelcontextprotocol/sdk)
│       ├── tools.ts               # Tool handlers (inspect, add, connect, update, validate)
│       ├── ipcClient.ts           # Extension IPC client for active editor buffer
│       └── bin.ts                 # CLI entry point for stdio transport
├── samples/                       # DEXPI sample files + pyDEXPI reference renderings
├── scripts/                       # render_reference_svgs.py (pyDEXPI reference SVGs)
└── test/                          # Unit & integration test suites
```

---

## Model Context Protocol (MCP) Server

The extension embeds `osiris-dexpi-mcp`, exposing tools to inspect and mutate the open diagram:

| Tool | Description |
| :--- | :--- |
| `get_pid_structure` | Returns JSON summary of equipment, nozzles, lines, valves, and instruments. |
| `add_equipment` | Inserts an equipment node with DEXPI-compliant coordinates and metadata. |
| `connect_piping` | Connects equipment or nozzles via process or instrument line. |
| `update_attributes` | Updates process parameters (tags, design pressure, fluid, temperature). |
| `validate_dexpi` | Runs schema conformance and topological connectivity checks. |

### Running the MCP Server

1. **Within VS Code**:
   The MCP server automatically detects and communicates with the active VS Code document buffer via an internal IPC bridge on `http://127.0.0.1:45123/mcp-bridge`.

2. **Standalone / CLI for LLM Agents (Claude Desktop, Antigravity, etc.)**:
   Add the following to your MCP client configuration (e.g. `claude_desktop_config.json` or Antigravity MCP settings):

   ```json
   {
     "mcpServers": {
       "osiris-dexpi": {
         "command": "node",
         "args": ["/path/to/osiris-dexpi/dist/mcp.js"]
       }
     }
   }
   ```

---

## Getting Started & Development

### Prerequisites
- Node.js >= 20.0.0
- npm >= 9.0.0

### Build & Test
```bash
# Install dependencies
npm install

# Run unit tests (SerDes round-trip, maxGraph adapter, MCP tools)
npm test

# Build extension, webview, and MCP bundles
npm run build

# Watch mode for extension development
npm run watch
```

### Launching in VS Code
1. Open the project in VS Code.
2. Press `F5` to open an Extension Development Host window.
3. Open any `.dexpi` file (such as `samples/simple-pid.dexpi`) — it opens in the Design editor by default.
4. Use the **P&ID** container in the Activity Bar for the symbol palette and Properties.
5. Toggle to the raw XML with the **Open Source (XML)** button in the editor title bar, and back with **Open with DEXPI Design Editor**.

---

## Releasing

Packaging the `.vsix` and publishing a GitHub release is automated by
`.github/workflows/release.yml`.

```bash
# 1. Bump the version in package.json (npm keeps it in sync with the tag)
npm version patch   # or minor / major

# 2. Push the commit and the tag
git push --follow-tags
```

Pushing a `v*` tag triggers the workflow, which runs the tests, builds the
`osiris-dexpi-<version>.vsix` (`npm run package`), and creates a GitHub release
for the tag with the VSIX attached and an auto-generated changelog. The tag must
match the `version` field in `package.json` or the workflow fails.

To build the package locally:

```bash
npm run package
```

---

## License
MIT © Richard Blaha

### Third-party

The P&ID symbol geometry in `src/maxgraph/stencils/vendor/` is from
[draw.io / diagrams.net](https://github.com/jgraph/drawio) (© JGraph Ltd), used
unmodified under the **Apache License 2.0**. See
`src/maxgraph/stencils/vendor/NOTICE.md`.


# OSM GeoJSON Tools — Unified

A single-page application that unifies 7 GeoJSON data-preparation tools for OpenStreetMap workflows. Load one GeoJSON file and run it through any tool without re-uploading.

## Tools

| Tab | Tool | What it does |
|-----|------|--------------|
| Inspect | Inspect Geometry | Search features by OSM tags (wizard or Overpass QL syntax), export subsets |
| Filter | Geometry Filter | Remove features by geometry type |
| Explorer | Feature Explorer | Browse property statistics, filter by value, keep/drop properties |
| Faker | Attribute Faker | Fill or randomise attribute values using Faker.js |
| Names | OSM → ArcGIS | Rename properties to ArcGIS-compatible field names |
| Editor | Property Editor | Edit individual feature properties, add/rename/delete columns, paginated table |
| Overpass | GeoJSON → Overpass | Convert polygon geometries to Overpass `poly:` filter strings |

## Standalone tool

**Get Polygon Coordinates** is kept as a standalone page (ArcGIS JS SDK map tool — different architecture):
→ See `Get_Polygon_Coordinates.html` in the [OSM-tools](../OSM-tools/) folder.

## Quick start

```sh
npm install
npm run dev        # http://localhost:5173
```

## Tests

```sh
npm test           # Vitest unit tests (164 tests)
npm run test:e2e   # Playwright integration tests (requires npm run dev or built dist)
```

## Build & deploy (GitHub Pages)

```sh
npm run build      # outputs to dist/
```

The `base: './'` in `vite.config.js` makes all asset paths relative, so the `dist/` folder works from any subdirectory on GitHub Pages or a plain file server.

To deploy to the `gh-pages` branch:

```sh
npx gh-pages -d dist
```

## Architecture

```
src/
  state.js              # Shared GeoJSON singleton + snapshot undo (max 20)
  main.js               # Global drag-and-drop file upload
  ui/
    status-bar.js       # Filename · feature count · geometry types · undo button
    tab-bar.js          # Lazy-loaded tool modules, mount/unmount lifecycle
  tools/<name>/
    logic.js            # Pure data-transformation functions (unit-tested)
    ui.js               # DOM shell: mount(container, state) / unmount()
  utils/
    download.js         # downloadGeoJSON helper
tests/
  unit/                 # Vitest — one file per logic.js module
  integration/          # Playwright — full upload → edit → undo scenarios
  fixtures/             # Sample GeoJSON files
```

Each tool's `logic.js` is zero-DOM (no `document.*`, no `Blob`, no `FileReader`) making it fully unit-testable with Vitest in Node.

Each tool's `ui.js` exports `mount(container, state)` and `unmount()`. The tab bar calls these when switching tabs or when a new file is loaded.

State changes flow through `state.update(newGeoJSON, label)` → snapshot saved → subscribers notified → status bar and undo button update automatically.

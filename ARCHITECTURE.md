# Architecture

How the Chengalpattu flood-response GIS is put together, and the **non-obvious
invariants** you must respect when changing it. Read this before adding a layer
or touching the map rendering — several of these rules have caused silent,
hard-to-debug breakage.

## Big picture

A static, offline-first single-page app. There is **no backend**: the browser
loads bundled vector tiles (PMTiles) and renders them with MapLibre. Everything
ships as static files and deploys to Cloudflare (see `README.md` → Deploy).

```
data/source/     India-wide open-data originals   (gitignored, ~1.9 GB, re-downloadable)
data/clipped/    intermediate clipped GeoJSON       (gitignored)
public/tiles/    clipped PMTiles                    → shipped, rendered in-app
public/downloads/ per-layer shapefile ZIPs          → shipped for download
scripts/         geodata pipeline + manifest + guards
src/             the React + TypeScript + Vite SPA
worker/          Cloudflare Worker (PMTiles range shim — see Deploy)
```

## The data flow for one layer

```
scripts/layers.manifest      declares the India-wide source + bbox filter
   │  (scripts/build-geodata.sh)
   ▼
public/tiles/<id>.pmtiles     clipped vector tiles  ┐
public/downloads/<id>.shp.zip clipped shapefile     ┘ shipped artifacts
   │
   ▼
src/data/geoLayers.ts        GEO_LAYERS: the app-side registry (one entry per layer)
src/data/layerStyles.ts      LAYER_STYLES: how each layer PAINTS
   │
   ▼
src/components/map/MapController.ts   adds sources + layers + companions to MapLibre
src/components/map/MapView.tsx        thin React lifecycle wrapper around MapController
```

## The invariants (break these and a layer silently vanishes)

### 1. `sourceLayer` MUST equal the vector-layer name inside the `.pmtiles`
Each layer's `GEO_LAYERS[].sourceLayer` must exactly match the internal
vector-layer name in its tile (`pmtiles show <file> --metadata` →
`vector_layers[].id`). A mismatch makes MapLibre find no features and the layer
renders **nothing, with no error**. `tippecanoe` names it via `-l <id>`;
`pmtiles extract` keeps the upstream name. **Guarded by
`npm run verify:tiles`** (`scripts/verify-source-layers.mjs`), which runs in CI.

### 2. Source `maxzoom` MUST equal the tile's real max zoom
`GEO_LAYERS[].tileMaxZoom` is declared as the source `maxzoom` so MapLibre
**overzooms** past it instead of requesting non-existent higher tiles (which
blanks the layer when you zoom in). Each layer's real max differs — don't guess.

### 3. `GEO_LAYERS` and `LAYER_STYLES` are two registries keyed by layer id
`GEO_LAYERS` (data: tile path, source, download, geometry) and `LAYER_STYLES`
(paint spec, companions, opacity behaviour) are separate objects. A `LAYER_STYLES`
key with no matching layer id does nothing. A layer with **no** style entry is
fine — it falls back to the geometry default in `defaultStyle`. **Guarded by
`src/data/layerStyles.test.ts`.**

### 4. Styling lives ONLY in `layerStyles.ts`, never in `MapView`/`MapController`
Each layer owns its `build()`, `companions[]`, and `applyOpacity()` **together**
in one `LAYER_STYLES` entry. This is deliberate: styling once lived in two
places (a paint builder + a separate opacity re-applier) that drifted out of
sync and shipped bugs. Keep both halves in the single entry.

### 5. MapLibre expression rule: `["zoom"]` only at the TOP LEVEL of a paint prop
A `["zoom"]` expression may **not** be nested inside `*`, `case`, etc. — MapLibre
rejects the whole layer (silent dark map). If you need zoom × data, restructure
rather than nest. (This shipped once as the water-opacity bug.)

### 6. `queryRenderedFeatures > 0` is NOT proof a layer paints
It counts features present in the tile even when nothing is drawn. Real
verification is **pixel-based** (see `tests/render.spec.ts`, which screenshots
and counts colored pixels) or a screenshot you actually look at.

### 7. Companion-layer suffix convention
Some layers add extra MapLibre layers named `geo-<id>-<suffix>`:
`-case` (road casing, drawn under), `-dash` (rail crossties / unmetalled roads),
`-hit` (invisible fill for village hover), `-label` (text). Declared in a style
entry's `companions[]`. `MapController.COMPANION_SUFFIXES` lists them for
visibility syncing — add new suffixes there too.

### 8. Draw order = `GEO_LAYERS` array order
The TOC grouping in the layer panel is **visual only** and does not affect draw
order. Villages/admin come before flood layers in the array so flood water draws
on top. Do not reorder `GEO_LAYERS` for panel purposes.

## How to add a layer

1. Add a row to `scripts/layers.manifest` (source URL, bbox, optional
   `whereSql` attribute filter).
2. Run `scripts/build-geodata.sh <id>` → produces `public/tiles/<id>.pmtiles`
   + `public/downloads/<id>.shp.zip`. Check the tile's internal layer name with
   `pmtiles show public/tiles/<id>.pmtiles --metadata`.
3. Add a `GEO_LAYERS` entry in `src/data/geoLayers.ts` — set `sourceLayer` to
   that internal name (invariant #1) and `tileMaxZoom` to the tile's real max
   (invariant #2).
4. (Optional) Add a `LAYER_STYLES` entry for custom paint; omit it for the
   geometry default.
5. Run `npm run verify:tiles && npm run test:unit && npm run build && npm test`.

The layer panel and Downloads page are data-driven from `GEO_LAYERS`, so they
pick up the new layer automatically — no UI edits needed.

## Testing (two tiers, deliberately split)

- **Vitest** (`npm run test:unit`, ~2s) — pure logic: store reducers, the admin
  zoom-switch rule, breakpoint mapping, style-registry coverage. Scoped to
  `src/**/*.test.ts` via `vitest.config.ts`.
- **Playwright** (`npm test`, ~18s) — real-browser rendering: every layer paints
  (pixel proof), panel→map wiring, zoom behaviour. Owns `tests/*.spec.ts`.

Both run in CI (`.github/workflows/ci.yml`) alongside lint, format-check, build,
and the tile-invariant check.

## Key modules

| File | Responsibility |
|---|---|
| `src/data/geoLayers.ts` | `GEO_LAYERS` registry (data) + groups + center/zoom |
| `src/data/layerStyles.ts` | `LAYER_STYLES` — per-layer paint, companions, opacity |
| `src/components/map/MapController.ts` | Imperative MapLibre wiring (framework-agnostic, unit-tested) |
| `src/components/map/mapLogic.ts` | Pure helpers (no maplibre import) — `layerBase`, `effectiveVisibility` |
| `src/components/map/MapView.tsx` | Thin React lifecycle glue around MapController |
| `src/components/map/mapSetup.ts` | pmtiles protocol, icon raster, base OSM style |
| `src/store/layerStore.ts` | Zustand: per-layer visibility/opacity + `osm`/`admin` pseudo-keys |
| `src/pages/DashboardPage.tsx` | Composes the map + tier-appropriate layer container |
| `src/hooks/useDeviceTier.ts` | desktop/tablet/mobile breakpoint decision |
| `src/styles/theme.ts` | Ant Design theme tokens (single source for colors) |

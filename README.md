# Chengalpattu Disaster Intelligence Grid

A flood-response GIS web app for Chengalpattu district, Tamil Nadu. Renders
offline vector map layers (PMTiles) in the browser and offers every layer as a
downloadable shapefile bundle.

## Stack

- **React 18 + TypeScript + Vite** SPA
- **React Router** — `/map` (GIS view), `/downloads` (shapefile bundles)
- **MapLibre GL** — class-based component, renders bundled PMTiles vector layers
- **Ant Design** (dark) — layout, layer panel, downloads
- **Zustand** — layer visibility/opacity state
- **pmtiles** — `pmtiles://` protocol for offline vector tiles

## Layers (flood-response set)

District & taluk boundaries, villages, rivers/streams, water bodies (tanks/eris),
watersheds, roads, national highways, railway tracks & stations, healthcare
facilities, schools (relief shelters).

Data © [India-Geodata](https://yashveeeeeeer.github.io/india-geodata/)
(CC-BY-4.0), clipped to the Chengalpattu district bounding box
(`79.3,12.2 → 80.3,13.0`).

> Note on boundary vintage: Chengalpattu district was carved out of Kancheepuram
> in 2019. The 2011 census layers label the area as Kancheepuram. Layers are
> clipped by geographic bounding box, so they cover the Chengalpattu area
> regardless of admin-boundary vintage.

## Geodata pipeline

`scripts/build-geodata.sh` reads `scripts/layers.manifest` and, per layer:

1. **Fetches** the India-wide open source into `data/source/` (cached, gitignored).
2. **PMTiles**: `pmtiles extract --bbox` pulls only the Chengalpattu tiles from
   the remote archive over HTTP range requests → `public/tiles/<id>.pmtiles`.
3. **Shapefile**: `ogr2ogr -spat` clips the vector source → a self-contained
   `.shp.zip` bundle in `public/downloads/<id>.shp.zip`.
4. Bundles everything into `public/downloads/all-layers.zip`.

GeoJSON-only sources (healthcare, education) are tiled with `tippecanoe`.

### Prerequisites

```
brew install pmtiles gdal tippecanoe   # + zip, curl (system)
```

### Run the pipeline

```
scripts/build-geodata.sh               # all layers
scripts/build-geodata.sh rivers roads  # only named layers
FORCE=1 scripts/build-geodata.sh       # re-download cached sources
```

To add/change a layer, edit `scripts/layers.manifest` and re-run. Then update
`src/data/geoLayers.ts` (the app-side registry) with the layer's render style
and the internal PMTiles source-layer name
(`pmtiles show <file> --metadata`).

## Develop

```
npm install
npm run dev        # http://127.0.0.1:5173
npm run build      # tsc + vite production build
npm test           # Playwright render tests (see below)
```

## Render tests

`tests/render.spec.ts` (Playwright + headless Chromium) is the real
verification that each layer *paints*, not just that its tiles are served —
it caught the invisible-taluk and missing-label bugs that tile checks missed.

For every layer it loads `/map`, waits for MapLibre to go idle, forces the
layer visible, jumps to a view where that layer has data, and asserts
`queryRenderedFeatures({ layers: ['geo-<id>'] })` returns > 0. It also asserts
the map boots with no MapLibre error events. The map instance is exposed as
`window.__map` for the test to drive.

```
npm test               # headless
npm run test:headed    # watch it run in a browser
npx playwright test tests/render.spec.ts -g villages   # one layer
```

First run needs the browser: `npx playwright install chromium`.

## Directory model

```
data/source/       India-wide originals (cached, NOT shipped)
data/clipped/      intermediate clipped GeoJSON
public/tiles/      clipped PMTiles      -> shipped, rendered in-app (~35 MB)
public/downloads/  shapefile ZIPs       -> shipped for distribution (~24 MB)
src/               React SPA
scripts/           geodata pipeline + manifest
```

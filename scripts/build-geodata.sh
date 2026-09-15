#!/usr/bin/env bash
#
# build-geodata.sh - Fetch India-wide open geodata, clip to the Chengalpattu
# district bounding box, and emit two distributable artifacts per layer:
#
#   1. public/tiles/<id>.pmtiles       -> rendered in-app by MapLibre
#   2. public/downloads/<id>.zip       -> shapefile bundle (.shp/.shx/.dbf/.prj)
#
# India-wide originals are cached under data/source/ (gitignored, NOT shipped).
# Intermediate clipped GeoJSON lands in data/clipped/.
#
# Requirements: pmtiles (go-pmtiles), ogr2ogr (GDAL), tippecanoe, zip, curl.
# Data (c) yashveeeeeeer/india-geodata, CC-BY-4.0.
#
# Usage:
#   scripts/build-geodata.sh            # build every layer in the manifest
#   scripts/build-geodata.sh rivers roads   # build only named layers
#   FORCE=1 scripts/build-geodata.sh    # re-download even if cached
#
set -euo pipefail

# --- Chengalpattu district bounding box (min_lon,min_lat,max_lon,max_lat) ---
BBOX_MINLON=79.3
BBOX_MINLAT=12.2
BBOX_MAXLON=80.3
BBOX_MAXLAT=13.0

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
MANIFEST="$SCRIPT_DIR/layers.manifest"

SRC_DIR="$ROOT_DIR/data/source"
CLIP_DIR="$ROOT_DIR/data/clipped"
TILES_DIR="$ROOT_DIR/public/tiles"
DL_DIR="$ROOT_DIR/public/downloads"

mkdir -p "$SRC_DIR" "$CLIP_DIR" "$TILES_DIR" "$DL_DIR"

for bin in pmtiles ogr2ogr tippecanoe zip curl; do
  command -v "$bin" >/dev/null 2>&1 || { echo "ERROR: '$bin' not found on PATH" >&2; exit 1; }
done

# Optional positional filter: only build these layer ids.
WANT=("$@")
want_layer() {
  [ ${#WANT[@]} -eq 0 ] && return 0
  local id="$1"; local w
  for w in "${WANT[@]}"; do [ "$w" = "$id" ] && return 0; done
  return 1
}

log() { printf '\n\033[1;36m[%s]\033[0m %s\n' "$(date +%H:%M:%S)" "$*"; }

# Download a URL into data/source/ (cached unless FORCE=1). Echoes the local path.
fetch() {
  local url="$1" dest="$SRC_DIR/$2"
  if [ "${FORCE:-0}" != "1" ] && [ -s "$dest" ]; then
    echo "$dest"; return 0
  fi
  curl -fSL --retry 3 -o "$dest" "$url" >/dev/null 2>&1 || {
    echo "WARN: download failed: $url" >&2; return 1;
  }
  echo "$dest"
}

# Emit a shapefile ZIP from a clipped GeoJSON, using GDAL's native .shp.zip
# driver (a self-contained bundle: .shp/.shx/.dbf/.prj inside one zip).
geojson_to_shpzip() {
  local geojson="$1" id="$2"
  local zip="$DL_DIR/$id.shp.zip"
  rm -f "$zip"
  ogr2ogr -f "ESRI Shapefile" "$zip" "$geojson" >/dev/null 2>&1 || {
    echo "WARN: shapefile export failed for $id" >&2; return 1;
  }
  echo "$zip"
}

build_layer() {
  local id="$1" geom="$2" pmurl="$3" vecurl="$4" vecfmt="$5" attrib="$6" labelfield="${7:-}" wheresql="${8:-}"
  log "Layer: $id ($geom) - $attrib"
  [ -n "$wheresql" ] && [ "$wheresql" != "-" ] && echo "  filter: WHERE $wheresql"

  # --- 1. PMTiles: bbox-extract from the remote India-wide archive ---------
  # Skip the pre-made extract when a WHERE filter is set OR a per-layer
  # tippecanoe feature-filter file exists (scripts/filters/<id>.filter.json):
  # both require tiling from the clipped GeoJSON with tippecanoe below.
  local filter_file="$SCRIPT_DIR/filters/$id.filter.json"
  local has_zoomfilter=0
  [ -f "$filter_file" ] && has_zoomfilter=1
  local has_filter=0
  [ -n "$wheresql" ] && [ "$wheresql" != "-" ] && has_filter=1
  if [ "$pmurl" != "-" ] && [ "$has_filter" = "0" ] && [ "$has_zoomfilter" = "0" ]; then
    if pmtiles extract "$pmurl" "$TILES_DIR/$id.pmtiles" \
         --bbox="$BBOX_MINLON,$BBOX_MINLAT,$BBOX_MAXLON,$BBOX_MAXLAT" \
         --quiet 2>/dev/null; then
      echo "  tiles  -> public/tiles/$id.pmtiles ($(du -h "$TILES_DIR/$id.pmtiles" | cut -f1))"
    else
      echo "  WARN: pmtiles extract failed for $id (will try tippecanoe from clipped GeoJSON)"
    fi
  fi
  [ "$has_zoomfilter" = "1" ] && echo "  filter: zoom-based feature filter ($id.filter.json)"

  # --- 2. Shapefile ZIP: clip the vector source by bbox --------------------
  local clipped="$CLIP_DIR/$id.geojson"
  if [ "$vecurl" != "-" ]; then
    local ext="parquet"; [ "$vecfmt" = "geojson" ] && ext="geojson"
    local srcfile
    if srcfile="$(fetch "$vecurl" "$id.$ext")"; then
      local where_args=()
      [ "$has_filter" = "1" ] && where_args=(-where "$wheresql")
      if ogr2ogr -f GeoJSON "$clipped" "$srcfile" \
           -spat "$BBOX_MINLON" "$BBOX_MINLAT" "$BBOX_MAXLON" "$BBOX_MAXLAT" \
           "${where_args[@]}" \
           >/dev/null 2>&1; then
        local feats
        feats="$(ogrinfo -so -al "$clipped" 2>/dev/null | awk -F': ' '/Feature Count/{print $2; exit}')"
        echo "  clip   -> data/clipped/$id.geojson ($feats features)"
        if geojson_to_shpzip "$clipped" "$id" >/dev/null; then
          echo "  shp    -> public/downloads/$id.shp.zip ($(du -h "$DL_DIR/$id.shp.zip" | cut -f1))"
        fi

        # Centroid label layer: one point per feature, so each name is drawn
        # exactly once (avoids per-tile label repetition on multi-tile polygons).
        if [ -n "$labelfield" ] && [ "$labelfield" != "-" ]; then
          local lblgeojson="$CLIP_DIR/${id}_labels.geojson"
          rm -f "$lblgeojson"
          # Derive the actual layer name (GeoJSON keeps the source's layer name,
          # which is not always the file stem — e.g. parquet 'soi_villages').
          local clip_layer
          clip_layer="$(ogrinfo "$clipped" 2>/dev/null | awk -F': ' '/^1: /{print $2; exit}' | awk '{print $1}')"
          [ -z "$clip_layer" ] && clip_layer="$id"
          if ogr2ogr -f GeoJSON "$lblgeojson" "$clipped" -dialect sqlite \
               -sql "SELECT ST_PointOnSurface(geometry) AS geometry, \"$labelfield\" AS name FROM \"$clip_layer\"" \
               >/dev/null 2>&1; then
            tippecanoe -o "$TILES_DIR/${id}_labels.pmtiles" -l "${id}_labels" \
              -Z0 -z13 -r1 --no-feature-limit --no-tile-size-limit \
              --force "$lblgeojson" >/dev/null 2>&1 \
              && echo "  label  -> public/tiles/${id}_labels.pmtiles (centroid points)"
          else
            echo "  WARN: centroid label build failed for $id"
          fi
        fi
        # Fallback: if PMTiles extract failed / absent, tile the clipped GeoJSON.
        # -z12 keeps point layers (health/education) legible at district zoom;
        # -zg under-zooms sparse points (health collapsed to z5), so pin it.
        if [ ! -s "$TILES_DIR/$id.pmtiles" ]; then
          if [ "$has_zoomfilter" = "1" ]; then
            # Zoom-based feature filtering (e.g. roads): keep arterials at low
            # zoom, minor features only when zoomed in. Wider zoom span + line
            # simplification, matching how basemaps generalize by scale.
            tippecanoe -o "$TILES_DIR/$id.pmtiles" -l "$id" \
              -Z6 -z14 --simplification=4 --no-feature-limit --no-tile-size-limit \
              --feature-filter-file="$filter_file" \
              --force "$clipped" >/dev/null 2>&1 \
              && echo "  tiles  -> public/tiles/$id.pmtiles (tippecanoe z6-14, zoom-filtered)"
          else
            tippecanoe -o "$TILES_DIR/$id.pmtiles" -l "$id" \
              -Z0 -z12 -r1 --cluster-distance=0 --no-feature-limit --no-tile-size-limit \
              --force "$clipped" >/dev/null 2>&1 \
              && echo "  tiles  -> public/tiles/$id.pmtiles (from tippecanoe, z0-12)"
          fi
        fi
      else
        echo "  WARN: clip failed for $id"
      fi
    fi
  fi
}

# --- Drive the manifest ------------------------------------------------------
BUILT=0
while IFS='|' read -r id geom pmurl vecurl vecfmt attrib labelfield wheresql || [ -n "$id" ]; do
  case "$id" in ''|\#*) continue ;; esac
  id="$(echo "$id" | xargs)"
  want_layer "$id" || continue
  build_layer "$id" "$(echo "$geom" | xargs)" "$(echo "$pmurl" | xargs)" \
    "$(echo "$vecurl" | xargs)" "$(echo "$vecfmt" | xargs)" \
    "$(echo "$attrib" | sed 's/^ *//;s/ *$//')" "$(echo "${labelfield:-}" | xargs)" \
    "$(echo "${wheresql:-}" | sed 's/^ *//;s/ *$//')"
  BUILT=$((BUILT+1))
done < "$MANIFEST"

# --- Emit an "all layers" combined shapefile ZIP for one-click distribution --
if [ ${#WANT[@]} -eq 0 ] && [ -n "$(ls -A "$DL_DIR"/*.shp.zip 2>/dev/null)" ]; then
  log "Bundling all-layers.zip"
  ALL="$DL_DIR/all-layers.zip"
  rm -f "$ALL"
  ( cd "$DL_DIR" && zip -q "$ALL" ./*.shp.zip )
  echo "  -> public/downloads/all-layers.zip ($(du -h "$ALL" | cut -f1))"
fi

log "Done. Built $BUILT layer(s)."
echo "Tiles:     $TILES_DIR"
echo "Downloads: $DL_DIR"

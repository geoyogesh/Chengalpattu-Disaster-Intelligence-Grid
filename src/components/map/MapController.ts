import maplibregl, { type Map as MapLibreMap } from 'maplibre-gl';

import { GEO_LAYERS, type GeoLayer } from '@/data/geoLayers';
import {
  LAYER_STYLES,
  defaultStyle,
  defaultApplyOpacity,
  type LayerBase,
} from '@/data/layerStyles';
import { pmtilesUrl } from '@/components/map/mapSetup';
import { BASEMAP_KEY } from '@/store/layerStore';
import { layerBase, effectiveVisibility } from '@/components/map/mapLogic';

// Re-export the pure helpers so existing importers keep working.
export { layerBase, effectiveVisibility } from '@/components/map/mapLogic';

/** Initial per-layer opacity applied at add time (overwritten by applyLayerState). */
export const INITIAL_OPACITY = 0.85;

/** All companion-layer suffixes, for visibility syncing. */
export const COMPANION_SUFFIXES = ['label', 'hit', 'dash', 'case', 'unmetalled'] as const;

export interface LayerUIState {
  visible: boolean;
  opacity: number;
}

// ---------------------------------------------------------------------------
// MapController — owns all imperative MapLibre wiring for a given map instance.
// Framework-agnostic (no React), so its behaviour is unit-testable with a
// mock map. MapView is now just lifecycle glue around this.
// ---------------------------------------------------------------------------

export class MapController {
  private layersAdded = false;
  private hoverPopup: maplibregl.Popup | null = null;

  constructor(private readonly map: MapLibreMap) {}

  /** Add every layer's source + main layer + companions + label layer. */
  addGeoLayers(): void {
    if (this.layersAdded) return;
    const map = this.map;

    for (const layer of GEO_LAYERS) {
      const base = layerBase(layer);
      const sourceId = base.source;

      if (!map.getSource(sourceId)) {
        // Declare the tile's real max zoom so MapLibre OVERZOOMS past it rather
        // than requesting non-existent higher tiles (which blanks the layer).
        map.addSource(sourceId, {
          type: 'vector',
          url: pmtilesUrl(layer.pmtiles),
          attribution: layer.attribution,
          maxzoom: layer.tileMaxZoom,
        });
      }

      const style = LAYER_STYLES[layer.id];
      const companions = style?.companions ?? [];

      // Under-companions (e.g. road casing) draw BEFORE the main layer.
      for (const c of companions.filter((x) => x.under)) {
        const id = `${base.id}-${c.suffix}`;
        if (!map.getLayer(id)) map.addLayer(c.build({ ...base, id }, layer));
      }

      // Main layer.
      const mainSpec = style
        ? style.build(base, layer, INITIAL_OPACITY)
        : defaultStyle(base, layer, INITIAL_OPACITY);
      if (!map.getLayer(base.id)) map.addLayer(mainSpec);

      // Over-companions (dashes, hover hit-area) draw AFTER the main layer.
      for (const c of companions.filter((x) => !x.under)) {
        const id = `${base.id}-${c.suffix}`;
        if (!map.getLayer(id)) map.addLayer(c.build({ ...base, id }, layer));
      }

      this.addLabelLayer(layer, base, sourceId);
    }
    this.layersAdded = true;
  }

  get isReady(): boolean {
    return this.layersAdded;
  }

  /**
   * Optional always-on text label layer (symbol). Prefers a dedicated centroid
   * point tileset (one point per feature) so names aren't repeated per tile.
   * Layers flagged hoverLabel skip this (names shown on hover instead).
   */
  private addLabelLayer(layer: GeoLayer, base: LayerBase, sourceId: string): void {
    if (!layer.labelField || layer.hoverLabel) return;
    const map = this.map;
    const labelId = `${base.id}-label`;
    if (map.getLayer(labelId)) return;

    const usePointSrc = Boolean(layer.labelPmtiles && layer.labelSourceLayer);
    const labelSourceId = usePointSrc ? `src-${layer.id}-labels` : sourceId;

    if (usePointSrc && !map.getSource(labelSourceId)) {
      map.addSource(labelSourceId, {
        type: 'vector',
        url: pmtilesUrl(layer.labelPmtiles!),
        maxzoom: 12, // centroid-label tilesets are built to z12; overzoom past.
      });
    }

    map.addLayer({
      id: labelId,
      type: 'symbol',
      source: labelSourceId,
      'source-layer': usePointSrc ? layer.labelSourceLayer! : layer.sourceLayer,
      ...(layer.labelMinZoom ? { minzoom: layer.labelMinZoom } : {}),
      layout: {
        'text-field': ['coalesce', ['get', layer.labelField], ''],
        'text-size': layer.id === 'district' ? 14 : 11,
        'text-font': ['Noto Sans Regular'],
        'symbol-placement': usePointSrc || layer.geom !== 'line' ? 'point' : 'line',
        'text-allow-overlap': false,
      },
      paint: {
        'text-color': '#f0f0f0',
        'text-halo-color': '#000000',
        'text-halo-width': 1.4,
      },
    });
  }

  /** Hover popups for hoverLabel layers (villages), via the invisible -hit fill. */
  setupHoverLabels(): void {
    const map = this.map;
    this.hoverPopup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      className: 'hover-popup',
    });

    for (const layer of GEO_LAYERS) {
      if (!layer.hoverLabel || !layer.labelField) continue;
      const layerId = `geo-${layer.id}-hit`;
      if (!map.getLayer(layerId)) continue;

      map.on('mousemove', layerId, (e) => {
        const f = e.features?.[0];
        if (!f) return;
        map.getCanvas().style.cursor = 'pointer';
        const name = (f.properties?.[layer.labelField!] as string) ?? '';
        if (!name) return;
        this.hoverPopup!.setLngLat(e.lngLat).setHTML(`<strong>${name}</strong>`).addTo(map);
      });
      map.on('mouseleave', layerId, () => {
        map.getCanvas().style.cursor = '';
        this.hoverPopup?.remove();
      });
    }
  }

  /** Diff UI state onto the map: visibility (incl. companions) + opacity. */
  applyLayerState(layerState: Record<string, LayerUIState>): void {
    const map = this.map;

    // Basemap (OSM raster) toggle + opacity.
    const osm = layerState[BASEMAP_KEY];
    if (osm && map.getLayer('osm-tiles')) {
      map.setLayoutProperty('osm-tiles', 'visibility', osm.visible ? 'visible' : 'none');
      map.setPaintProperty('osm-tiles', 'raster-opacity', osm.opacity);
    }

    const zoom = map.getZoom();

    for (const layer of GEO_LAYERS) {
      const ui = layerState[layer.id];
      const layerId = `geo-${layer.id}`;
      if (!ui || !map.getLayer(layerId)) continue;

      const vis = effectiveVisibility(layer, ui.visible, zoom) ? 'visible' : 'none';

      map.setLayoutProperty(layerId, 'visibility', vis);
      for (const suffix of COMPANION_SUFFIXES) {
        const cid = `${layerId}-${suffix}`;
        if (map.getLayer(cid)) map.setLayoutProperty(cid, 'visibility', vis);
      }

      // Opacity: each layer owns how the slider re-applies (registry), else the
      // geometry default. A registry applyOpacity may be a no-op to PIN paint.
      const style = LAYER_STYLES[layer.id];
      if (style?.applyOpacity) {
        style.applyOpacity(map, layerId, ui.opacity, layer);
      } else {
        defaultApplyOpacity(map, layerId, ui.opacity, layer);
      }
    }
  }
}

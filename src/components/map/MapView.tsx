import { Component, createRef } from 'react';
import maplibregl, { type Map as MapLibreMap } from 'maplibre-gl';

import { GEO_LAYERS, ADMIN_ZOOM_SWITCH, type GeoLayer } from '@/data/geoLayers';
import {
  LAYER_STYLES,
  defaultStyle,
  defaultApplyOpacity,
  type LayerBase,
} from '@/data/layerStyles';
import {
  ensurePmtilesProtocol,
  pmtilesUrl,
  registerIcons,
  OSM_RASTER_STYLE,
} from '@/components/map/mapSetup';

/** Initial per-layer opacity applied at add time (overwritten by applyLayerState). */
const INITIAL_OPACITY = 0.85;

export interface LayerUIState {
  visible: boolean;
  opacity: number;
}

export interface MapViewProps {
  center: [number, number];
  zoom: number;
  /** Keyed by layer id -> UI state (visibility + opacity). */
  layerState: Record<string, LayerUIState>;
  /** Called with the map instance once it has loaded (for overlay controls). */
  onMapReady?: (map: MapLibreMap) => void;
}

/** All companion-layer suffixes, for visibility syncing. */
const COMPANION_SUFFIXES = ['label', 'hit', 'dash', 'case', 'unmetalled'] as const;

/**
 * Class-based MapLibre wrapper rendering bundled PMTiles vector layers.
 *
 * Styling is NOT defined here — each layer owns its paint spec, companions and
 * opacity behaviour in `src/data/layerStyles.ts` (the single source of truth).
 * This component is the dumb renderer: create the map, add each layer's source
 * + main layer + companions from the registry, and diff UI state on update.
 */
export class MapView extends Component<MapViewProps> {
  private readonly containerRef = createRef<HTMLDivElement>();
  private map: MapLibreMap | null = null;
  private layersAdded = false;
  private hoverPopup: maplibregl.Popup | null = null;

  override componentDidMount(): void {
    if (!this.containerRef.current) return;
    ensurePmtilesProtocol();

    const map = new maplibregl.Map({
      container: this.containerRef.current,
      style: OSM_RASTER_STYLE,
      center: this.props.center,
      zoom: this.props.zoom,
      minZoom: 4,
      maxZoom: 18,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

    map.on('error', (e) => {
       
      console.error('[MapLibre error]', e.error?.message ?? e.error ?? e);
    });

    map.on('load', () => {
      void registerIcons(map).then(() => {
        this.addGeoLayers();
        this.applyLayerState();
        this.setupHoverLabels();
        (window as unknown as { __map?: MapLibreMap }).__map = map;
        this.props.onMapReady?.(map);
      });
    });

    map.on('zoomend', () => this.applyLayerState());
    this.map = map;
  }

  override componentDidUpdate(prevProps: MapViewProps): void {
    if (!this.map || !this.layersAdded) return;
    if (prevProps.layerState !== this.props.layerState) {
      this.applyLayerState();
    }
  }

  override componentWillUnmount(): void {
    this.map?.remove();
    this.map = null;
  }

  private baseFor(layer: GeoLayer): LayerBase {
    return {
      id: `geo-${layer.id}`,
      source: `src-${layer.id}`,
      'source-layer': layer.sourceLayer,
    };
  }

  private addGeoLayers(): void {
    if (!this.map || this.layersAdded) return;
    const map = this.map;

    for (const layer of GEO_LAYERS) {
      const base = this.baseFor(layer);
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

  /**
   * Optional always-on text label layer (symbol). Prefers a dedicated centroid
   * point tileset (one point per feature) so names aren't repeated per tile.
   * Layers flagged hoverLabel skip this (names shown on hover instead).
   */
  private addLabelLayer(layer: GeoLayer, base: LayerBase, sourceId: string): void {
    if (!this.map || !layer.labelField || layer.hoverLabel) return;
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
  private setupHoverLabels(): void {
    if (!this.map) return;
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

  private applyLayerState(): void {
    if (!this.map) return;
    const map = this.map;

    // Basemap (OSM raster) toggle + opacity.
    const osm = this.props.layerState.osm;
    if (osm && map.getLayer('osm-tiles')) {
      map.setLayoutProperty('osm-tiles', 'visibility', osm.visible ? 'visible' : 'none');
      map.setPaintProperty('osm-tiles', 'raster-opacity', osm.opacity);
    }

    const zoom = map.getZoom();

    for (const layer of GEO_LAYERS) {
      const ui = this.props.layerState[layer.id];
      const layerId = `geo-${layer.id}`;
      if (!ui || !map.getLayer(layerId)) continue;

      // Admin-group members share one panel toggle but only one draws at a
      // time: district when zoomed OUT, taluks when zoomed IN.
      let visible = ui.visible;
      if (layer.adminGroup) {
        const inDistrictBand = zoom < ADMIN_ZOOM_SWITCH;
        const isDistrict = layer.id === 'district';
        visible = ui.visible && (isDistrict ? inDistrictBand : !inDistrictBand);
      }
      const vis = visible ? 'visible' : 'none';

      map.setLayoutProperty(layerId, 'visibility', vis);
      // Keep every companion layer's visibility in sync with its parent.
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

  override render() {
    return (
      <div className="map-wrap">
        <div ref={this.containerRef} className="map-container" />
      </div>
    );
  }
}

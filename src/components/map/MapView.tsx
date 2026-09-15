import { Component, createRef } from 'react';
import maplibregl, {
  type LayerSpecification,
  type Map as MapLibreMap,
  type StyleSpecification,
} from 'maplibre-gl';
import { Protocol } from 'pmtiles';

import { GEO_LAYERS, ADMIN_ZOOM_SWITCH, type GeoLayer } from '@/data/geoLayers';
import { FLAT_ICONS, rasterizeIcon } from '@/components/map/makiIcons';

/** Register the pmtiles:// protocol with MapLibre exactly once per page. */
let pmtilesProtocolRegistered = false;
function ensurePmtilesProtocol(): void {
  if (pmtilesProtocolRegistered) return;
  const protocol = new Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile);
  pmtilesProtocolRegistered = true;
}

/**
 * Register the flat pre-coloured POI icons as raster map images (once per map).
 * No SDF — colours are baked in, so they stay crisp and need no runtime tint.
 */
async function registerIcons(map: MapLibreMap): Promise<void> {
  for (const [id, svg] of Object.entries(FLAT_ICONS)) {
    if (map.hasImage(id)) continue;
    try {
      const { image, ratio } = await rasterizeIcon(svg, 44, 2);
      if (!map.hasImage(id)) {
        map.addImage(id, image, { pixelRatio: ratio });
      }
    } catch {
      // Best-effort; a missing icon just won't render.
    }
  }
}

const OSM_RASTER_STYLE: StyleSpecification = {
  version: 8,
  // Font glyphs are required for any symbol (text) layer to render.
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors · Layers © India-Geodata (CC-BY-4.0)',
    },
  },
  layers: [{ id: 'osm-tiles', type: 'raster', source: 'osm', minzoom: 0, maxzoom: 19 }],
};

/** Absolute URL to a bundled PMTiles file (pmtiles:// + origin + path). */
function pmtilesUrl(publicPath: string): string {
  return `pmtiles://${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}${publicPath}`;
}

/** Build the MapLibre style layer for a GeoLayer. */
function styleLayerFor(layer: GeoLayer, opacity: number): LayerSpecification {
  const base = {
    id: `geo-${layer.id}`,
    source: `src-${layer.id}`,
    'source-layer': layer.sourceLayer,
  };
  // The district is rendered as a bold outline (a faint fill is invisible on
  // the basemap); every other polygon layer gets a translucent fill + outline.
  if (layer.id === 'district') {
    return {
      ...base,
      type: 'line',
      paint: {
        'line-color': '#000000',
        'line-width': 3,
        'line-opacity': 0.9,
      },
    };
  }
  // Taluks: coloured outline (no heavy fill) so each boundary reads clearly.
  if (layer.id === 'subdistricts') {
    return {
      ...base,
      type: 'line',
      paint: {
        'line-color': layer.color,
        'line-width': 2.2,
        'line-opacity': opacity,
        'line-dasharray': [2, 1],
      },
    };
  }
  // Villages: thin grey hairline, NO fill, so they read as quiet reference
  // beneath the flood layers and never occlude water/tanks/rivers. Visible only
  // when zoomed in (z >= 12); names appear on hover (see hover handler).
  if (layer.id === 'villages') {
    return {
      ...base,
      type: 'line',
      minzoom: 12,
      paint: {
        'line-color': layer.color,
        'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.4, 15, 1],
        'line-opacity': 0.5,
      },
    };
  }
  // Point facilities render as a flat pre-coloured badge icon (no SDF, no pin).
  // Colours are baked into the image; sized generously so they're legible.
  if (layer.geom === 'circle' && layer.icon) {
    return {
      ...base,
      type: 'symbol',
      layout: {
        'icon-image': layer.icon,
        // Small at district/overview zoom, growing prominent only up close.
        'icon-size': [
          'interpolate', ['linear'], ['zoom'],
          9, 0.16,
          11, 0.24,
          13, 0.45,
          16, 0.9,
        ],
        'icon-allow-overlap': true,
        'icon-anchor': 'center',
      },
    };
  }
  // Railway tracks: standard cartographic symbol — a dark casing line with a
  // white dashed hatch on top (added as a companion in addGeoLayers), so it
  // reads as rail, not a road.
  if (layer.id === 'railtracks') {
    return {
      ...base,
      type: 'line',
      paint: {
        'line-color': '#40404a',
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.5, 14, 4],
        'line-opacity': opacity,
      },
    };
  }
  // Roads: 3-tier class hierarchy from road_type (NH > SH > minor). NH is the
  // boldest (red) — the single road layer now carries NH too, so there is no
  // separate highways layer double-drawing it. A dark casing sits underneath
  // (companion) and an UNMETALLED dashed overlay marks fair-weather roads.
  if (layer.id === 'roads') {
    return {
      ...base,
      type: 'line',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      // Backstop: below z12 only major roads (NH/SH) draw, even if a minor
      // road slipped into a low-zoom tile. Tiling already drops most; this
      // guarantees the overview stays clean.
      filter: [
        'any',
        ['==', ['get', 'road_type'], 'NATIONAL HIGHWAY'],
        ['==', ['get', 'road_type'], 'STATE HIGHWAY'],
        ['>=', ['zoom'], 12],
      ],
      paint: {
        'line-color': [
          'match', ['get', 'road_type'],
          'NATIONAL HIGHWAY', '#e8590c',
          'STATE HIGHWAY', '#ffa94d',
          '#9a6a3a',
        ],
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          9, ['match', ['get', 'road_type'], 'NATIONAL HIGHWAY', 1.8, 'STATE HIGHWAY', 1.2, 0.4],
          13, ['match', ['get', 'road_type'], 'NATIONAL HIGHWAY', 4, 'STATE HIGHWAY', 3, 1.2],
          16, ['match', ['get', 'road_type'], 'NATIONAL HIGHWAY', 7, 'STATE HIGHWAY', 6, 3],
        ],
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0.55, 13, 0.95],
      },
    };
  }
  // Tanks: drawn as a thin outline (not a fill) so they annotate the WRIS
  // waterbody fills (which they ~58% overlap) rather than double-painting a
  // solid blue blob. Tank boundary = a distinct cyan-blue ring.
  if (layer.id === 'tanks') {
    return {
      ...base,
      type: 'line',
      paint: {
        'line-color': '#4dabf7',
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.4, 14, 1.2],
        'line-opacity': opacity,
      },
    };
  }
  // Water bodies: the flood "hero" layer. Raw WRIS = ~7,600 polygons, 70%+
  // sub-0.1 km2 field ponds. Two things make it read well instead of as one
  // overpowering flat-blue blanket:
  //  (1) scale-dependent generalization — reveal water by SIZE as you zoom in
  //      (only big eris/lakes at overview, ponds only up close) via `area_ha`.
  //  (2) SIZE-GRADUATED colour + opacity — small tanks are a muted, low-opacity
  //      mid-blue that recedes; large eris and lakes/reservoirs get a deeper,
  //      more saturated, more opaque blue so the flood-significant water is the
  //      thing that pops. This classification (tank -> eri -> lake) is what
  //      turns a uniform blue mass into a legible hierarchy.
  if (layer.id === 'waterbodies') {
    return {
      ...base,
      type: 'fill',
      filter: [
        '>=', ['to-number', ['get', 'area_ha'], 0],
        ['interpolate', ['linear'], ['zoom'], 9, 50, 11, 10, 13, 2, 14, 0],
      ],
      paint: {
        // Graduated blue by area: small tanks muted, lakes deep & saturated.
        'fill-color': [
          'interpolate', ['linear'], ['to-number', ['get', 'area_ha'], 0],
          0, '#3b6ea5',    // small tank — muted, sits back
          25, '#2f7dd1',   // large tank / small eri
          100, '#1c6fd6',  // eri
          400, '#0b5bc4',  // lake / reservoir — deep hero blue
        ],
        // Graduated opacity: small water is quieter so it stops overpowering,
        // big water is solid. area x slider only — a `zoom` expression may NOT
        // be nested inside `*` (MapLibre only allows zoom at the top level of a
        // paint property), so the zoom lift is intentionally omitted here.
        'fill-opacity': [
          '*',
          opacity,
          ['interpolate', ['linear'], ['to-number', ['get', 'area_ha'], 0],
            0, 0.42,
            25, 0.6,
            100, 0.72,
            400, 0.82,
          ],
        ],
        'fill-outline-color': [
          'interpolate', ['linear'], ['zoom'],
          12, 'rgba(0,0,0,0)',
          13.5, '#74c0fc',
        ],
      },
    };
  }
  // Rivers & streams: classify by the source `layer` field (major | minor).
  // A single flat cyan line reads as noise; a hierarchy reads as a river
  // network — the major river (Palar) is a bold, brighter, more opaque line
  // with round caps; minor streams are thinner and softer. Widths ramp with
  // zoom so the network scales like a real basemap.
  if (layer.id === 'rivers') {
    return {
      ...base,
      type: 'line',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['case', ['==', ['get', 'layer'], 'major'], '#3bc9db', '#2f9e9e'],
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          8, ['case', ['==', ['get', 'layer'], 'major'], 1.6, 0.6],
          12, ['case', ['==', ['get', 'layer'], 'major'], 3.2, 1.2],
          16, ['case', ['==', ['get', 'layer'], 'major'], 6, 2.6],
        ],
        'line-opacity': ['case', ['==', ['get', 'layer'], 'major'], opacity, opacity * 0.75],
      },
    };
  }
  switch (layer.geom) {
    case 'fill':
      return {
        ...base,
        type: 'fill',
        paint: {
          'fill-color': layer.color,
          'fill-opacity': opacity * 0.4,
          'fill-outline-color': layer.color,
        },
      };
    case 'line':
      return {
        ...base,
        type: 'line',
        paint: {
          'line-color': layer.color,
          'line-width': 1.4,
          'line-opacity': opacity,
        },
      };
    case 'circle':
      return {
        ...base,
        type: 'circle',
        paint: {
          'circle-radius': 4,
          'circle-color': layer.color,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1,
          'circle-opacity': opacity,
        },
      };
  }
}

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

/**
 * Class-based MapLibre wrapper rendering bundled PMTiles vector layers.
 *
 * MapLibre owns a long-lived imperative map instance, which maps onto the
 * React class lifecycle:
 *   - componentDidMount:    create map, register pmtiles://, add sources+layers
 *   - componentDidUpdate:   diff layerState and toggle visibility/opacity
 *   - componentWillUnmount: dispose the map
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
      // eslint-disable-next-line no-console
      console.error('[MapLibre error]', e.error?.message ?? e.error ?? e);
    });

    map.on('load', () => {
      void registerIcons(map).then(() => {
        this.addGeoLayers();
        this.applyLayerState();
        this.setupHoverLabels();
        // Expose the map for automated render tests (Playwright).
        (window as unknown as { __map?: MapLibreMap }).__map = map;
        this.props.onMapReady?.(map);
      });
    });

    // Admin boundaries switch between district (zoomed out) and taluks (zoomed
    // in) automatically, so re-evaluate visibility whenever the zoom changes.
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

  private addGeoLayers(): void {
    if (!this.map || this.layersAdded) return;
    for (const layer of GEO_LAYERS) {
      const sourceId = `src-${layer.id}`;
      if (!this.map.getSource(sourceId)) {
        // Declare the source's real max tile zoom so MapLibre OVERZOOMS past it
        // instead of requesting non-existent higher tiles (which blanks out).
        this.map.addSource(sourceId, {
          type: 'vector',
          url: pmtilesUrl(layer.pmtiles),
          attribution: layer.attribution,
          maxzoom: layer.tileMaxZoom,
        });
      }
      // Roads: add the dark casing UNDER the road fill first (draw order =
      // add order), then the class-styled fill, then an UNMETALLED dashed
      // overlay marking fair-weather roads that may be impassable in flood.
      if (layer.id === 'roads') {
        const caseId = `geo-${layer.id}-case`;
        if (!this.map.getLayer(caseId)) {
          this.map.addLayer({
            id: caseId,
            type: 'line',
            source: sourceId,
            'source-layer': layer.sourceLayer,
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            filter: [
              'any',
              ['==', ['get', 'road_type'], 'NATIONAL HIGHWAY'],
              ['==', ['get', 'road_type'], 'STATE HIGHWAY'],
              ['>=', ['zoom'], 12],
            ],
            paint: {
              'line-color': '#1a1a1a',
              'line-width': [
                'interpolate', ['linear'], ['zoom'],
                9, ['match', ['get', 'road_type'], 'NATIONAL HIGHWAY', 3, 'STATE HIGHWAY', 2.2, 1],
                13, ['match', ['get', 'road_type'], 'NATIONAL HIGHWAY', 6, 'STATE HIGHWAY', 4.5, 2.2],
                16, ['match', ['get', 'road_type'], 'NATIONAL HIGHWAY', 9.5, 'STATE HIGHWAY', 8, 4.5],
              ],
              'line-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0.3, 13, 0.7],
            },
          });
        }
      }

      const styleLayer = styleLayerFor(layer, 0.85);
      if (!this.map.getLayer(styleLayer.id)) {
        this.map.addLayer(styleLayer);
      }

      // Roads: dashed overlay for UNMETALLED (fair-weather) roads on top of
      // the solid fill, so flood-impassable segments are distinguishable.
      if (layer.id === 'roads') {
        const dashId = `geo-${layer.id}-unmetalled`;
        if (!this.map.getLayer(dashId)) {
          this.map.addLayer({
            id: dashId,
            type: 'line',
            source: sourceId,
            'source-layer': layer.sourceLayer,
            filter: ['==', ['get', 'surface'], 'UNMETALLED'],
            layout: { 'line-cap': 'butt' },
            paint: {
              'line-color': '#1a1a1a',
              'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.6, 13, 1.6, 16, 3],
              'line-dasharray': [1.5, 2],
              'line-opacity': 0.9,
            },
          });
        }
      }

      // Railway tracks: white dashed hatch (crossties) over the dark casing,
      // the standard cartographic rail symbol.
      if (layer.id === 'railtracks') {
        const dashId = `geo-${layer.id}-dash`;
        if (!this.map.getLayer(dashId)) {
          this.map.addLayer({
            id: dashId,
            type: 'line',
            source: sourceId,
            'source-layer': layer.sourceLayer,
            paint: {
              'line-color': '#ffffff',
              'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1, 14, 2.4],
              'line-dasharray': [2, 3],
            },
          });
        }
      }

      // Villages: an invisible fill (opacity 0) purely for hover hit-testing,
      // so the whole polygon area is hoverable — the visible layer is just the
      // hairline. The transparent fill occludes nothing.
      if (layer.id === 'villages') {
        const hitId = `geo-${layer.id}-hit`;
        if (!this.map.getLayer(hitId)) {
          this.map.addLayer({
            id: hitId,
            type: 'fill',
            source: sourceId,
            'source-layer': layer.sourceLayer,
            minzoom: 12,
            paint: { 'fill-color': layer.color, 'fill-opacity': 0 },
          });
        }
      }

      // Optional text label layer (symbol). Prefer a dedicated centroid point
      // tileset (one point per feature) so names aren't repeated per tile.
      // hoverLabel layers skip the always-on symbol layer (shown on hover).
      if (layer.labelField && !layer.hoverLabel) {
        const labelId = `geo-${layer.id}-label`;
        const usePointSrc = Boolean(layer.labelPmtiles && layer.labelSourceLayer);
        const labelSourceId = usePointSrc ? `src-${layer.id}-labels` : sourceId;

        if (usePointSrc && !this.map.getSource(labelSourceId)) {
          this.map.addSource(labelSourceId, {
            type: 'vector',
            url: pmtilesUrl(layer.labelPmtiles!),
            // Centroid-label tilesets are built to z12; overzoom beyond that.
            maxzoom: 12,
          });
        }

        if (!this.map.getLayer(labelId)) {
          this.map.addLayer({
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
      }
    }
    this.layersAdded = true;
  }

  /**
   * Wire hover popups for layers flagged hoverLabel (villages). Names appear
   * only under the cursor instead of carpeting the map.
   */
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
      // Hover hit-testing uses the invisible fill layer so the whole polygon
      // is hoverable, not just the hairline stroke.
      const layerId = `geo-${layer.id}-hit`;
      if (!map.getLayer(layerId)) continue;

      map.on('mousemove', layerId, (e) => {
        const f = e.features?.[0];
        if (!f) return;
        map.getCanvas().style.cursor = 'pointer';
        const name = (f.properties?.[layer.labelField!] as string) ?? '';
        if (!name) return;
        this.hoverPopup!
          .setLngLat(e.lngLat)
          .setHTML(`<strong>${name}</strong>`)
          .addTo(map);
      });
      map.on('mouseleave', layerId, () => {
        map.getCanvas().style.cursor = '';
        this.hoverPopup?.remove();
      });
    }
  }

  private applyLayerState(): void {
    if (!this.map) return;

    // Basemap (OSM raster) toggle + opacity.
    const osm = this.props.layerState.osm;
    if (osm && this.map.getLayer('osm-tiles')) {
      this.map.setLayoutProperty('osm-tiles', 'visibility', osm.visible ? 'visible' : 'none');
      this.map.setPaintProperty('osm-tiles', 'raster-opacity', osm.opacity);
    }

    const zoom = this.map.getZoom();

    for (const layer of GEO_LAYERS) {
      const ui = this.props.layerState[layer.id];
      const layerId = `geo-${layer.id}`;
      if (!ui || !this.map.getLayer(layerId)) continue;

      // Effective visibility. Admin-group members share the panel toggle but
      // only one draws at a time: district when zoomed OUT (below the switch),
      // taluks when zoomed IN (at/above it).
      let visible = ui.visible;
      if (layer.adminGroup) {
        const inDistrictBand = zoom < ADMIN_ZOOM_SWITCH;
        const isDistrict = layer.id === 'district';
        visible = ui.visible && (isDistrict ? inDistrictBand : !inDistrictBand);
      }

      this.map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');

      // Keep any companion label layer in sync with its parent's visibility.
      const labelId = `${layerId}-label`;
      if (this.map.getLayer(labelId)) {
        this.map.setLayoutProperty(labelId, 'visibility', visible ? 'visible' : 'none');
      }
      // Keep the invisible hover hit-layer (villages) in sync too.
      const hitId = `${layerId}-hit`;
      if (this.map.getLayer(hitId)) {
        this.map.setLayoutProperty(hitId, 'visibility', visible ? 'visible' : 'none');
      }
      // Keep the railway dashed-hatch companion in sync too.
      const dashId = `${layerId}-dash`;
      if (this.map.getLayer(dashId)) {
        this.map.setLayoutProperty(dashId, 'visibility', visible ? 'visible' : 'none');
      }
      // Keep the road casing companion in sync too.
      const caseId = `${layerId}-case`;
      if (this.map.getLayer(caseId)) {
        this.map.setLayoutProperty(caseId, 'visibility', visible ? 'visible' : 'none');
      }
      // Keep the unmetalled-road dashed overlay in sync too.
      const unmetId = `${layerId}-unmetalled`;
      if (this.map.getLayer(unmetId)) {
        this.map.setLayoutProperty(unmetId, 'visibility', visible ? 'visible' : 'none');
      }

      // Opacity property differs per geometry type. District is drawn as a line.
      if (layer.id === 'district') {
        this.map.setPaintProperty(layerId, 'line-opacity', 0.9);
      } else if (layer.id === 'subdistricts') {
        this.map.setPaintProperty(layerId, 'line-opacity', ui.opacity);
      } else if (layer.id === 'tanks') {
        // Rendered as an outline (line), not a fill.
        this.map.setPaintProperty(layerId, 'line-opacity', ui.opacity);
      } else if (layer.id === 'villages') {
        // Villages use a fixed zoom-ramped fill/outline for the multi-scale
        // design; the opacity slider must not flatten the ramp.
        continue;
      } else if (layer.id === 'roads' || layer.id === 'railtracks') {
        // These carry class/zoom-driven paint expressions; don't flatten them.
        continue;
      } else if (layer.id === 'rivers') {
        // Rivers carry a major/minor case expression; re-apply it scaled by the
        // slider rather than flattening to one value.
        this.map.setPaintProperty(layerId, 'line-opacity', [
          'case', ['==', ['get', 'layer'], 'major'], ui.opacity, ui.opacity * 0.75,
        ]);
      } else if (layer.id === 'waterbodies') {
        // Water uses a size-graduated (area x zoom) fill-opacity for the
        // hierarchy; re-apply it scaled by the slider so classification and
        // generalization survive an opacity change.
        this.map.setPaintProperty(layerId, 'fill-opacity', [
          '*',
          ui.opacity,
          ['interpolate', ['linear'], ['to-number', ['get', 'area_ha'], 0], 0, 0.42, 25, 0.6, 100, 0.72, 400, 0.82],
        ]);
      } else if (layer.geom === 'fill') {
        this.map.setPaintProperty(layerId, 'fill-opacity', ui.opacity * 0.4);
      } else if (layer.geom === 'line') {
        this.map.setPaintProperty(layerId, 'line-opacity', ui.opacity);
      } else if (layer.icon) {
        this.map.setPaintProperty(layerId, 'icon-opacity', ui.opacity);
      } else {
        this.map.setPaintProperty(layerId, 'circle-opacity', ui.opacity);
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

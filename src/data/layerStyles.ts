import type { ExpressionSpecification, LayerSpecification, Map as MapLibreMap } from 'maplibre-gl';

import type { GeoLayer } from '@/data/geoLayers';

/**
 * Per-layer cartographic styling — the SINGLE source of truth for how each
 * layer paints, its companion layers, and how the opacity slider re-applies.
 *
 * WHY THIS MODULE EXISTS
 * ----------------------
 * The map styling used to live in two places inside MapView: a 200-line
 * `styleLayerFor` if/else building the paint spec, AND a parallel if/else in
 * `applyLayerState` re-applying opacity. Keeping those two in sync by hand is
 * exactly what let the water-opacity ramp drift and the illegal nested-`zoom`
 * expression ship. Here each layer owns BOTH in one place, next to each other,
 * so they can never disagree. MapView just iterates the registry.
 *
 * A layer with no entry here uses the geometry default (see `defaultStyle`).
 */

/** A companion is an extra map layer drawn with/under the main one. */
export interface CompanionSpec {
  /** Suffix appended to `geo-<id>` (e.g. 'case', 'dash', 'hit', 'unmetalled'). */
  suffix: string;
  /**
   * Draw the companion BEFORE the main layer (under it) when true — e.g. a road
   * casing. Companions default to drawing after (over) the main layer.
   */
  under?: boolean;
  /** Build the companion's spec given the shared base (id/source/source-layer). */
  build: (base: LayerBase, layer: GeoLayer) => LayerSpecification;
}

export interface LayerStyleDef {
  /** Build the main MapLibre layer spec for this layer at the given opacity. */
  build: (base: LayerBase, layer: GeoLayer, opacity: number) => LayerSpecification;
  /** Extra layers (casing, dashes, hover hit-area) drawn with the main one. */
  companions?: CompanionSpec[];
  /**
   * Re-apply the opacity slider. If omitted, MapView applies the geometry
   * default. Return without touching paint (a no-op) to PIN the layer's paint
   * against the slider (used where a zoom/class ramp must not be flattened).
   */
  applyOpacity?: (map: MapLibreMap, layerId: string, opacity: number, layer: GeoLayer) => void;
}

export interface LayerBase {
  id: string;
  source: string;
  'source-layer': string;
}

const iconSizeRamp: ExpressionSpecification = [
  'interpolate', ['linear'], ['zoom'],
  9, 0.16,
  11, 0.24,
  13, 0.45,
  16, 0.9,
];

/** Reused road class filter: NH/SH always, everything else only from z12. */
const roadClassFilter: ExpressionSpecification = [
  'any',
  ['==', ['get', 'road_type'], 'NATIONAL HIGHWAY'],
  ['==', ['get', 'road_type'], 'STATE HIGHWAY'],
  ['>=', ['zoom'], 12],
];

const areaHa: ExpressionSpecification = ['to-number', ['get', 'area_ha'], 0];
const riverIsMajor: ExpressionSpecification = ['==', ['get', 'layer'], 'major'];

/** Water bodies' size-graduated fill-opacity, scaled by the slider. */
function waterOpacity(opacity: number): ExpressionSpecification {
  return [
    '*',
    opacity,
    ['interpolate', ['linear'], areaHa, 0, 0.42, 25, 0.6, 100, 0.72, 400, 0.82],
  ];
}

/** River major/minor line-opacity, scaled by the slider. */
function riverOpacity(opacity: number): ExpressionSpecification {
  return ['case', riverIsMajor, opacity, opacity * 0.75];
}

/**
 * The style registry, keyed by layer id. Everything here is moved VERBATIM from
 * the old MapView.styleLayerFor / addGeoLayers / applyLayerState so behaviour is
 * byte-identical — the refactor is purely about WHERE the logic lives.
 */
export const LAYER_STYLES: Record<string, LayerStyleDef> = {
  // District: bold black outline (a faint fill is invisible on the basemap).
  district: {
    build: (base) => ({
      ...base,
      type: 'line',
      paint: { 'line-color': '#000000', 'line-width': 3, 'line-opacity': 0.9 },
    }),
    applyOpacity: (map, layerId) => map.setPaintProperty(layerId, 'line-opacity', 0.9),
  },

  // Taluks: coloured dashed outline, no heavy fill.
  subdistricts: {
    build: (base, layer, opacity) => ({
      ...base,
      type: 'line',
      paint: {
        'line-color': layer.color,
        'line-width': 2.2,
        'line-opacity': opacity,
        'line-dasharray': [2, 1],
      },
    }),
    applyOpacity: (map, layerId, opacity) => map.setPaintProperty(layerId, 'line-opacity', opacity),
  },

  // Villages: grey hairline (no fill), zoom-gated >= z12; names on hover only
  // (via the invisible -hit companion). Fixed zoom ramp — slider must NOT
  // flatten it, so applyOpacity is a deliberate no-op.
  villages: {
    build: (base, layer) => ({
      ...base,
      type: 'line',
      minzoom: 12,
      paint: {
        'line-color': layer.color,
        'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.4, 15, 1],
        'line-opacity': 0.5,
      },
    }),
    companions: [
      {
        suffix: 'hit',
        build: (base, layer) => ({
          ...base,
          type: 'fill',
          minzoom: 12,
          paint: { 'fill-color': layer.color, 'fill-opacity': 0 },
        }),
      },
    ],
    applyOpacity: () => {
      /* pinned: fixed zoom ramp, do not flatten */
    },
  },

  // Railway tracks: dark casing + white dashed crosstie hatch companion.
  railtracks: {
    build: (base, _layer, opacity) => ({
      ...base,
      type: 'line',
      paint: {
        'line-color': '#40404a',
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.5, 14, 4],
        'line-opacity': opacity,
      },
    }),
    companions: [
      {
        suffix: 'dash',
        build: (base) => ({
          ...base,
          type: 'line',
          paint: {
            'line-color': '#ffffff',
            'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1, 14, 2.4],
            'line-dasharray': [2, 3],
          },
        }),
      },
    ],
    applyOpacity: () => {
      /* pinned: zoom-driven width/opacity */
    },
  },

  // Roads: NH>SH>minor class hierarchy, dark casing UNDER, unmetalled dashes OVER.
  roads: {
    build: (base) => ({
      ...base,
      type: 'line',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      filter: roadClassFilter,
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
    }),
    companions: [
      {
        suffix: 'case',
        under: true,
        build: (base) => ({
          ...base,
          type: 'line',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          filter: roadClassFilter,
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
        }),
      },
      {
        suffix: 'unmetalled',
        build: (base) => ({
          ...base,
          type: 'line',
          filter: ['==', ['get', 'surface'], 'UNMETALLED'],
          layout: { 'line-cap': 'butt' },
          paint: {
            'line-color': '#1a1a1a',
            'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.6, 13, 1.6, 16, 3],
            'line-dasharray': [1.5, 2],
            'line-opacity': 0.9,
          },
        }),
      },
    ],
    applyOpacity: () => {
      /* pinned: class/zoom-driven paint */
    },
  },

  // Tanks: thin cyan outline over the WRIS waterbody fills (they ~58% overlap).
  tanks: {
    build: (base) => ({
      ...base,
      type: 'line',
      paint: {
        'line-color': '#4dabf7',
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.4, 14, 1.2],
        'line-opacity': 1,
      },
    }),
    applyOpacity: (map, layerId, opacity) => map.setPaintProperty(layerId, 'line-opacity', opacity),
  },

  // Water bodies: size-graduated fill (tank -> eri -> lake) + zoom-by-size filter.
  waterbodies: {
    build: (base, _layer, opacity) => ({
      ...base,
      type: 'fill',
      filter: [
        '>=', areaHa,
        ['interpolate', ['linear'], ['zoom'], 9, 50, 11, 10, 13, 2, 14, 0],
      ],
      paint: {
        'fill-color': [
          'interpolate', ['linear'], areaHa,
          0, '#3b6ea5',
          25, '#2f7dd1',
          100, '#1c6fd6',
          400, '#0b5bc4',
        ],
        'fill-opacity': waterOpacity(opacity),
        'fill-outline-color': [
          'interpolate', ['linear'], ['zoom'],
          12, 'rgba(0,0,0,0)',
          13.5, '#74c0fc',
        ],
      },
    }),
    applyOpacity: (map, layerId, opacity) =>
      map.setPaintProperty(layerId, 'fill-opacity', waterOpacity(opacity)),
  },

  // Rivers & streams: major/minor class hierarchy.
  rivers: {
    build: (base, _layer, opacity) => ({
      ...base,
      type: 'line',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['case', riverIsMajor, '#3bc9db', '#2f9e9e'],
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          8, ['case', riverIsMajor, 1.6, 0.6],
          12, ['case', riverIsMajor, 3.2, 1.2],
          16, ['case', riverIsMajor, 6, 2.6],
        ],
        'line-opacity': riverOpacity(opacity),
      },
    }),
    applyOpacity: (map, layerId, opacity) =>
      map.setPaintProperty(layerId, 'line-opacity', riverOpacity(opacity)),
  },
};

/** Geometry default when a layer has no dedicated style + a facility icon. */
export function iconStyle(base: LayerBase, layer: GeoLayer): LayerSpecification {
  return {
    ...base,
    type: 'symbol',
    layout: {
      'icon-image': layer.icon!,
      'icon-size': iconSizeRamp,
      'icon-allow-overlap': true,
      'icon-anchor': 'center',
    },
  };
}

/** Geometry default paint for layers with no dedicated LAYER_STYLES entry. */
export function defaultStyle(base: LayerBase, layer: GeoLayer, opacity: number): LayerSpecification {
  if (layer.geom === 'circle' && layer.icon) return iconStyle(base, layer);
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
        paint: { 'line-color': layer.color, 'line-width': 1.4, 'line-opacity': opacity },
      };
    case 'circle':
    default:
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

/** Apply the geometry-default opacity for a layer with no custom applyOpacity. */
export function defaultApplyOpacity(
  map: MapLibreMap,
  layerId: string,
  opacity: number,
  layer: GeoLayer,
): void {
  if (layer.geom === 'fill') {
    map.setPaintProperty(layerId, 'fill-opacity', opacity * 0.4);
  } else if (layer.geom === 'line') {
    map.setPaintProperty(layerId, 'line-opacity', opacity);
  } else if (layer.icon) {
    map.setPaintProperty(layerId, 'icon-opacity', opacity);
  } else {
    map.setPaintProperty(layerId, 'circle-opacity', opacity);
  }
}

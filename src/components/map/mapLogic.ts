import { ADMIN_ZOOM_SWITCH, type GeoLayer } from '@/data/geoLayers';
import type { LayerBase } from '@/data/layerStyles';

/**
 * Pure map logic — NO maplibre-gl import, so it's unit-testable in jsdom
 * without maplibre's module init touching browser-only APIs. MapController
 * re-exports these for its own use.
 */

/** The shared id/source/source-layer base for a layer's MapLibre layers. */
export function layerBase(layer: GeoLayer): LayerBase {
  return {
    id: `geo-${layer.id}`,
    source: `src-${layer.id}`,
    'source-layer': layer.sourceLayer,
  };
}

/**
 * Effective visibility for a layer at a given zoom. Admin-group members share
 * one toggle but only one draws at a time: the district below the zoom switch,
 * the taluks at/above it. Non-admin layers just follow their own toggle.
 */
export function effectiveVisibility(layer: GeoLayer, userVisible: boolean, zoom: number): boolean {
  if (!layer.adminGroup) return userVisible;
  const inDistrictBand = zoom < ADMIN_ZOOM_SWITCH;
  const isDistrict = layer.id === 'district';
  return userVisible && (isDistrict ? inDistrictBand : !inDistrictBand);
}

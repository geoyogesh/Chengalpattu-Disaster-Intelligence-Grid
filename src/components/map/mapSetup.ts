import maplibregl, {
  type Map as MapLibreMap,
  type StyleSpecification,
} from 'maplibre-gl';
import { Protocol } from 'pmtiles';

import { FLAT_ICONS, rasterizeIcon } from '@/components/map/makiIcons';

/** Register the pmtiles:// protocol with MapLibre exactly once per page. */
let pmtilesProtocolRegistered = false;
export function ensurePmtilesProtocol(): void {
  if (pmtilesProtocolRegistered) return;
  const protocol = new Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile);
  pmtilesProtocolRegistered = true;
}

/** Absolute URL to a bundled PMTiles file (pmtiles:// + origin + base + path). */
export function pmtilesUrl(publicPath: string): string {
  return `pmtiles://${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}${publicPath}`;
}

/**
 * Register the flat pre-coloured POI icons as raster map images (once per map).
 * No SDF — colours are baked in, so they stay crisp and need no runtime tint.
 */
export async function registerIcons(map: MapLibreMap): Promise<void> {
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

/** Base raster style: OSM tiles + glyphs for symbol (text) layers. */
export const OSM_RASTER_STYLE: StyleSpecification = {
  version: 8,
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

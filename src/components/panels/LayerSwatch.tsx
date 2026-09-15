import type { GeoLayer } from '@/data/geoLayers';

/**
 * A legend/label swatch whose SHAPE matches how the layer draws on the map:
 * a filled square for polygons, a thick bar for lines, a dot for point
 * facilities. This is a best-practice legend affordance — the swatch tells you
 * the geometry, not just the colour.
 */
export function LayerSwatch({ geom, color }: { geom: GeoLayer['geom']; color: string }) {
  const base: React.CSSProperties = {
    display: 'inline-block',
    flex: '0 0 auto',
    backgroundColor: color,
  };
  if (geom === 'line') {
    return <span aria-hidden style={{ ...base, width: 14, height: 3, borderRadius: 2 }} />;
  }
  if (geom === 'circle') {
    return <span aria-hidden style={{ ...base, width: 11, height: 11, borderRadius: '50%' }} />;
  }
  return <span aria-hidden style={{ ...base, width: 12, height: 12, borderRadius: 3 }} />;
}

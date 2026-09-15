import { describe, it, expect } from 'vitest';

import { LAYER_STYLES } from './layerStyles';
import { GEO_LAYERS } from '@/data/geoLayers';

/**
 * Guards the two-registry invariant introduced when styling moved out of
 * MapView: GEO_LAYERS (data) and LAYER_STYLES (style) are separate objects
 * keyed by layer id. A style keyed to a non-existent / misspelled layer id does
 * nothing silently; this test makes that drift a red build instead.
 *
 * (The reverse — a layer with no style entry — is intentionally allowed: it
 * falls back to the geometry default in defaultStyle.)
 */
describe('LAYER_STYLES <-> GEO_LAYERS coverage', () => {
  const validIds = new Set(GEO_LAYERS.map((l) => l.id));

  it('every LAYER_STYLES key is a real GEO_LAYERS id', () => {
    const orphaned = Object.keys(LAYER_STYLES).filter((id) => !validIds.has(id));
    expect(
      orphaned,
      `LAYER_STYLES has keys with no matching layer: ${orphaned.join(', ')}`,
    ).toEqual([]);
  });

  it('every styled layer builds a spec whose id/source match the layer', () => {
    for (const layer of GEO_LAYERS) {
      const style = LAYER_STYLES[layer.id];
      if (!style) continue;
      const base = {
        id: `geo-${layer.id}`,
        source: `src-${layer.id}`,
        'source-layer': layer.sourceLayer,
      };
      const spec = style.build(base, layer, 0.85);
      expect(spec.id).toBe(`geo-${layer.id}`);
      expect(spec.source).toBe(`src-${layer.id}`);
    }
  });
});

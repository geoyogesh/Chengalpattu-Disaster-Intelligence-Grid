import { describe, it, expect } from 'vitest';

import { layerBase, effectiveVisibility } from './mapLogic';
import type { GeoLayer } from '@/data/geoLayers';

// Minimal GeoLayer factory for the pure-function tests (only the fields the
// functions under test read).
function fakeLayer(over: Partial<GeoLayer>): GeoLayer {
  return {
    id: 'x',
    label: 'X',
    group: 'flood',
    tileMaxZoom: 12,
    geom: 'fill',
    pmtiles: '/tiles/x.pmtiles',
    sourceLayer: 'x_src',
    download: '/downloads/x.shp.zip',
    color: '#fff',
    defaultVisible: false,
    attribution: 'test',
    ...over,
  };
}

describe('layerBase', () => {
  it('derives geo-/src- ids and the source-layer', () => {
    const base = layerBase(fakeLayer({ id: 'rivers', sourceLayer: 'WRIS_Rivers' }));
    expect(base).toEqual({
      id: 'geo-rivers',
      source: 'src-rivers',
      'source-layer': 'WRIS_Rivers',
    });
  });
});

describe('effectiveVisibility', () => {
  it('non-admin layers just follow their own toggle', () => {
    const l = fakeLayer({ id: 'waterbodies' });
    expect(effectiveVisibility(l, true, 8)).toBe(true);
    expect(effectiveVisibility(l, false, 8)).toBe(false);
    expect(effectiveVisibility(l, true, 15)).toBe(true);
  });

  it('district (admin) shows only BELOW the zoom switch (z<10)', () => {
    const district = fakeLayer({ id: 'district', adminGroup: true });
    expect(effectiveVisibility(district, true, 8)).toBe(true); // zoomed out
    expect(effectiveVisibility(district, true, 10)).toBe(false); // at switch -> taluks
    expect(effectiveVisibility(district, true, 13)).toBe(false); // zoomed in
  });

  it('taluks (admin, non-district) show only AT/ABOVE the zoom switch', () => {
    const taluks = fakeLayer({ id: 'subdistricts', adminGroup: true });
    expect(effectiveVisibility(taluks, true, 8)).toBe(false); // zoomed out -> district
    expect(effectiveVisibility(taluks, true, 10)).toBe(true); // at switch
    expect(effectiveVisibility(taluks, true, 13)).toBe(true); // zoomed in
  });

  it('admin visibility is still gated by the user toggle being on', () => {
    const district = fakeLayer({ id: 'district', adminGroup: true });
    expect(effectiveVisibility(district, false, 8)).toBe(false);
  });
});

import { describe, it, expect, beforeEach } from 'vitest';

import { useLayerStore, BASEMAP_KEY, ADMIN_GROUP_KEY } from './layerStore';
import { GEO_LAYERS } from '@/data/geoLayers';

const adminIds = GEO_LAYERS.filter((l) => l.adminGroup).map((l) => l.id);
const s = () => useLayerStore.getState();

// Reset to a known baseline before each test (hideAll then toggle admin on).
beforeEach(() => {
  s().hideAll();
});

describe('layerStore', () => {
  it('seeds the basemap and admin pseudo-keys', () => {
    // Fresh store module state includes both pseudo-keys.
    const keys = Object.keys(useLayerStore.getInitialState().layers);
    expect(keys).toContain(BASEMAP_KEY);
    expect(keys).toContain(ADMIN_GROUP_KEY);
  });

  it('honours registry defaultVisible for real layers on init', () => {
    const init = useLayerStore.getInitialState().layers;
    for (const l of GEO_LAYERS) {
      const expected = l.adminGroup ? true : l.defaultVisible;
      expect(init[l.id].visible).toBe(expected);
    }
  });

  it('toggleLayer flips a single layer', () => {
    s().toggleLayer('waterbodies', true);
    expect(s().layers.waterbodies.visible).toBe(true);
    s().toggleLayer('waterbodies');
    expect(s().layers.waterbodies.visible).toBe(false);
  });

  it('toggling the admin group cascades to all admin member layers', () => {
    s().toggleLayer(ADMIN_GROUP_KEY, true);
    expect(s().layers[ADMIN_GROUP_KEY].visible).toBe(true);
    for (const id of adminIds) expect(s().layers[id].visible).toBe(true);

    s().toggleLayer(ADMIN_GROUP_KEY, false);
    for (const id of adminIds) expect(s().layers[id].visible).toBe(false);
  });

  it('setOpacity on the admin group cascades to members', () => {
    s().setOpacity(ADMIN_GROUP_KEY, 0.3);
    for (const id of adminIds) expect(s().layers[id].opacity).toBeCloseTo(0.3);
  });

  it('showAll / hideAll flip every key', () => {
    s().hideAll();
    expect(Object.values(s().layers).every((v) => !v.visible)).toBe(true);
    s().showAll();
    expect(Object.values(s().layers).every((v) => v.visible)).toBe(true);
  });

  it('ignores unknown keys without throwing', () => {
    expect(() => s().toggleLayer('does-not-exist', true)).not.toThrow();
    expect(s().layers['does-not-exist']).toBeUndefined();
  });
});

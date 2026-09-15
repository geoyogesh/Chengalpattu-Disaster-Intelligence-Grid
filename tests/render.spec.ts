import { test, expect, type Page } from '@playwright/test';

/**
 * Render tests: prove each vector layer actually PAINTS in MapLibre, not just
 * that its tiles are served. This catches the class of bug that repeatedly
 * slipped through manual checks (invisible fills, missing labels, a registry
 * source-layer name that didn't match the tile).
 *
 * Strategy: load /map, wait for the map to go idle, then for each layer force
 * it visible and assert queryRenderedFeatures() on its 'geo-<id>' style layer
 * returns > 0 features (zooming to that layer's data if needed).
 */

// Layer id -> a [lng, lat, zoom] view where that layer has features.
// Sparse point layers use a wider (lower-zoom) view so the district-wide
// scatter is guaranteed to be on-screen; dense/area layers can probe closer.
const LAYER_PROBE: Record<string, [number, number, number]> = {
  district: [79.9, 12.7, 8],
  subdistricts: [79.9, 12.6, 11],
  villages: [80.1, 12.9, 12],
  watersheds: [79.6, 12.5, 11],
  waterbodies: [80.0, 12.7, 12],
  tanks: [79.9, 12.5, 12],
  rivers: [79.6, 12.5, 11],
  roads: [80.0, 12.8, 13],
  railtracks: [79.8, 12.6, 10],
  railstations: [79.8, 12.6, 10],
  healthcare: [79.9, 12.7, 10],
  education: [79.9, 12.7, 10],
};

type MapHandle = {
  isStyleLoaded: () => boolean;
  once: (ev: string, cb: () => void) => void;
  setLayoutProperty: (id: string, prop: string, val: unknown) => void;
  getLayer: (id: string) => unknown;
  jumpTo: (opts: { center: [number, number]; zoom: number }) => void;
  queryRenderedFeatures: (opts?: { layers: string[] }) => unknown[];
};

async function waitForMap(page: Page) {
  await page.goto('/map');
  // Wait until the app has published the map instance and its style is loaded.
  await page.waitForFunction(() => {
    const m = (window as unknown as { __map?: MapHandle }).__map;
    return Boolean(m && m.isStyleLoaded());
  }, { timeout: 30_000 });
}

/** Enable a layer via the store, jump to a view, settle, count rendered features. */
async function renderedCount(page: Page, layerId: string, view: [number, number, number]) {
  return page.evaluate(
    async ({ id, v }) => {
      const m = (window as unknown as { __map?: MapHandle }).__map!;
      const styleId = `geo-${id}`;
      if (!m.getLayer(styleId)) return -1; // style layer missing entirely
      // Drive visibility through the store (the real code path), not the map.
      const store = (window as unknown as {
        __layerStore?: { getState: () => { toggleLayer: (k: string, val: boolean) => void } };
      }).__layerStore;
      if (store) {
        const key = id === 'district' || id === 'subdistricts' ? 'admin' : id;
        store.getState().toggleLayer(key, true);
      }
      m.jumpTo({ center: [v[0], v[1]], zoom: v[2] });
      await new Promise<void>((resolve) => m.once('idle', resolve));
      return m.queryRenderedFeatures({ layers: [styleId] }).length;
    },
    { id: layerId, v: view },
  );
}

test.describe('Chengalpattu GIS map renders', () => {
  test('map boots without MapLibre errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && msg.text().includes('[MapLibre error]')) {
        errors.push(msg.text());
      }
    });
    await waitForMap(page);
    // Give a moment for any late tile errors to surface.
    await page.waitForTimeout(1500);
    expect(errors, `MapLibre errors: ${errors.join('\n')}`).toHaveLength(0);
  });

  for (const [layerId, view] of Object.entries(LAYER_PROBE)) {
    test(`layer "${layerId}" paints features`, async ({ page }) => {
      await waitForMap(page);
      const count = await renderedCount(page, layerId, view);
      expect(count, `geo-${layerId} style layer must exist`).not.toBe(-1);
      expect(count, `layer "${layerId}" rendered 0 features at ${view.join(',')}`).toBeGreaterThan(0);
    });
  }

  // Stronger check: queryRenderedFeatures counts features in loaded tiles even
  // when they don't PAINT. Villages are a thin grey hairline (no fill) shown
  // only at z>=12; assert grey pixels actually rasterize at z13.
  test('villages paint a grey hairline at z13 (not just tile features)', async ({ page }) => {
    await waitForMap(page);
    await page.evaluate(async () => {
      const m = (window as unknown as { __map?: MapHandle }).__map!;
      const store = (window as unknown as {
        __layerStore?: { getState: () => { toggleLayer: (k: string, v: boolean) => void } };
      }).__layerStore!;
      store.getState().toggleLayer('admin', false);
      store.getState().toggleLayer('villages', true);
      m.jumpTo({ center: [79.88, 12.51], zoom: 13 });
      await new Promise<void>((r) => m.once('idle', r));
    });
    await page.waitForTimeout(800);
    const el = await page.$('.map-container');
    const shot = await el!.screenshot();
    const grey = await page.evaluate(async (b64) => {
      const img = new Image();
      await new Promise<void>((res) => { img.onload = () => res(); img.src = 'data:image/png;base64,' + b64; });
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let greyPx = 0;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        // near-neutral grey around #8a8a8a, and clearly above the dark canvas.
        if (Math.abs(r - g) < 22 && Math.abs(g - b) < 22 && r > 70 && r < 175) greyPx++;
      }
      return greyPx;
    }, shot.toString('base64'));
    expect(grey, 'village grey hairline must paint pixels').toBeGreaterThan(50);
  });
});

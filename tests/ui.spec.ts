import { test, expect, type Page } from '@playwright/test';

/**
 * UI-driven end-to-end tests: exercise the REAL Ant Design panel controls
 * (switches, sliders, buttons) and assert the map reacts. These cover the
 * panel->store->map wiring that the render tests bypass by calling the map
 * directly.
 */

type MapHandle = {
  isStyleLoaded: () => boolean;
  getLayoutProperty: (id: string, prop: string) => unknown;
  getPaintProperty: (id: string, prop: string) => unknown;
  getLayer: (id: string) => unknown;
  getZoom: () => number;
  jumpTo: (o: { center: [number, number]; zoom: number }) => void;
  once: (ev: string, cb: () => void) => void;
  queryRenderedFeatures: (opts?: { layers: string[] }) => unknown[];
};

async function waitForMap(page: Page) {
  await page.goto('/map');
  await page.waitForFunction(
    () => Boolean((window as unknown as { __map?: MapHandle }).__map?.isStyleLoaded()),
    { timeout: 30_000 },
  );
}

/** Expand a collapsed TOC group so its switches are interactable. */
async function openGroup(page: Page, name: string) {
  const header = page.getByRole('button', { name, exact: false });
  // AntD collapse header toggles aria-expanded; open it if not already.
  const expanded = await header.first().getAttribute('aria-expanded');
  if (expanded !== 'true') await header.first().click();
}

function visibility(page: Page, styleLayerId: string) {
  return page.evaluate((id) => {
    const m = (window as unknown as { __map?: MapHandle }).__map!;
    if (!m.getLayer(id)) return 'missing';
    // Default (unset) visibility means 'visible'.
    return (m.getLayoutProperty(id, 'visibility') as string) ?? 'visible';
  }, styleLayerId);
}

test.describe('Layer panel drives the map', () => {
  test('default view shows only admin boundaries', async ({ page }) => {
    await waitForMap(page);
    // Admin toggle on; data layers off. Open the groups that hold them first.
    await openGroup(page, 'Reference');
    await openGroup(page, 'Access & Evacuation');
    await expect(page.getByLabel('Toggle admin boundaries')).toBeChecked();
    await expect(page.getByLabel('Toggle Villages')).not.toBeChecked();
    await expect(page.getByLabel('Toggle Roads')).not.toBeChecked();
    await expect(page.getByLabel('Toggle basemap')).not.toBeChecked();

    // At the default zoom (10) taluks draw, district is hidden by the zoom band.
    const z = await page.evaluate(
      () => (window as unknown as { __map?: MapHandle }).__map!.getZoom(),
    );
    expect(z).toBeGreaterThanOrEqual(10);
    expect(await visibility(page, 'geo-subdistricts')).toBe('visible');
    expect(await visibility(page, 'geo-district')).toBe('none');
    // A data layer that's toggled off must not be drawn.
    expect(await visibility(page, 'geo-roads')).toBe('none');
  });

  test('toggling a layer switch shows/hides it on the map', async ({ page }) => {
    await waitForMap(page);
    await openGroup(page, 'Access & Evacuation');
    expect(await visibility(page, 'geo-roads')).toBe('none');

    await page.getByLabel('Toggle Roads').click();
    await expect(page.getByLabel('Toggle Roads')).toBeChecked();
    await expect
      .poll(() => visibility(page, 'geo-roads'), { timeout: 5000 })
      .toBe('visible');

    await page.getByLabel('Toggle Roads').click();
    await expect
      .poll(() => visibility(page, 'geo-roads'), { timeout: 5000 })
      .toBe('none');
  });

  test('admin group switches district<->taluks by zoom', async ({ page }) => {
    await waitForMap(page);
    // Zoom OUT below the switch: district shows, taluks hide.
    await page.evaluate(async () => {
      const m = (window as unknown as { __map?: MapHandle }).__map!;
      m.jumpTo({ center: [79.9, 12.6], zoom: 8 });
      await new Promise<void>((r) => m.once('idle', r));
    });
    await expect.poll(() => visibility(page, 'geo-district')).toBe('visible');
    await expect.poll(() => visibility(page, 'geo-subdistricts')).toBe('none');

    // Zoom IN at/above the switch: taluks show, district hides.
    await page.evaluate(async () => {
      const m = (window as unknown as { __map?: MapHandle }).__map!;
      m.jumpTo({ center: [79.9, 12.6], zoom: 12 });
      await new Promise<void>((r) => m.once('idle', r));
    });
    await expect.poll(() => visibility(page, 'geo-subdistricts')).toBe('visible');
    await expect.poll(() => visibility(page, 'geo-district')).toBe('none');
  });

  test('admin toggle off hides both district and taluks', async ({ page }) => {
    await waitForMap(page);
    await openGroup(page, 'Reference');
    await page.getByLabel('Toggle admin boundaries').click();
    await expect(page.getByLabel('Toggle admin boundaries')).not.toBeChecked();
    await expect.poll(() => visibility(page, 'geo-subdistricts')).toBe('none');
    await expect.poll(() => visibility(page, 'geo-district')).toBe('none');
  });

  test('Hide all then Show all', async ({ page }) => {
    await waitForMap(page);
    await openGroup(page, 'Access & Evacuation');
    await page.getByRole('button', { name: 'Hide all' }).click();
    await expect.poll(() => visibility(page, 'geo-subdistricts')).toBe('none');

    await page.getByRole('button', { name: 'Show all' }).click();
    // Roads become on; at default zoom taluks (admin) are on too.
    await expect(page.getByLabel('Toggle Roads')).toBeChecked();
    await expect.poll(() => visibility(page, 'geo-roads')).toBe('visible');
  });

  test('basemap toggle controls the OSM raster', async ({ page }) => {
    await waitForMap(page);
    await openGroup(page, 'Reference');
    expect(await visibility(page, 'osm-tiles')).toBe('none');
    await page.getByLabel('Toggle basemap').click();
    await expect.poll(() => visibility(page, 'osm-tiles')).toBe('visible');
  });

  test('villages: hidden when zoomed out, grey hairline when zoomed in', async ({ page }) => {
    await waitForMap(page);
    await openGroup(page, 'Reference');
    await page.getByLabel('Toggle Villages').click();

    // z11: village hairline suppressed by minzoom:12.
    const band2 = await page.evaluate(async () => {
      const m = (window as unknown as { __map?: MapHandle }).__map!;
      m.jumpTo({ center: [79.88, 12.51], zoom: 11 });
      await new Promise<void>((r) => m.once('idle', r));
      return m.queryRenderedFeatures({ layers: ['geo-villages'] }).length;
    });
    expect(band2, 'village lines should be suppressed at z11').toBe(0);

    // z13: village hairline drawn.
    const band3 = await page.evaluate(async () => {
      const m = (window as unknown as { __map?: MapHandle }).__map!;
      m.jumpTo({ center: [79.88, 12.51], zoom: 13 });
      await new Promise<void>((r) => m.once('idle', r));
      return m.queryRenderedFeatures({ layers: ['geo-villages'] }).length;
    });
    expect(band3, 'village hairline should show at z13').toBeGreaterThan(0);
  });

  test('village names are NOT carpeted (no always-on label layer)', async ({ page }) => {
    await waitForMap(page);
    const hasLabelLayer = await page.evaluate(
      () => Boolean((window as unknown as { __map?: MapHandle }).__map!.getLayer('geo-villages-label')),
    );
    expect(hasLabelLayer, 'villages must not have an always-on label layer').toBe(false);
  });

  test('TOC groups render with flood expanded and reference collapsed', async ({ page }) => {
    await waitForMap(page);
    for (const g of ['Flood & Water', 'Response & Relief', 'Access & Evacuation', 'Reference']) {
      await expect(page.getByRole('button', { name: g, exact: false }).first()).toBeVisible();
    }
    // Flood open by default -> a flood switch visible; reference collapsed -> hidden.
    await expect(page.getByLabel('Toggle Water bodies (tanks/eris)')).toBeVisible();
    await expect(page.getByLabel('Toggle Villages')).toBeHidden();
  });
});

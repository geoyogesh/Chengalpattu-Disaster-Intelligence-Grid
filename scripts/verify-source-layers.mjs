#!/usr/bin/env node
/**
 * verify-source-layers.mjs — guards a CRITICAL invariant that has broken the
 * map several times: the registry's `sourceLayer` for each layer MUST equal the
 * vector-layer name actually inside that layer's .pmtiles. A mismatch makes the
 * layer silently invisible (MapLibre finds no matching source-layer).
 *
 * For every layer in GEO_LAYERS it runs `pmtiles show <file> --metadata`, reads
 * the vector_layers[].id list, and asserts the registry sourceLayer is present.
 *
 * Requires the `pmtiles` CLI on PATH. Exits non-zero on any mismatch so CI fails.
 *
 * Usage:  node scripts/verify-source-layers.mjs
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Parse the layer id -> sourceLayer + pmtiles path out of the TS registry
// without a TS toolchain: a tolerant regex over each layer object literal.
const registrySrc = readFileSync(join(root, 'src/data/geoLayers.ts'), 'utf8');
const layerBlocks = registrySrc.split(/\n\s*\{\s*\n/).slice(1);

const layers = [];
for (const block of layerBlocks) {
  const id = block.match(/id:\s*'([^']+)'/)?.[1];
  const pmtiles = block.match(/pmtiles:\s*'([^']+)'/)?.[1];
  const sourceLayer = block.match(/sourceLayer:\s*'([^']+)'/)?.[1];
  if (id && pmtiles && sourceLayer) layers.push({ id, pmtiles, sourceLayer });
}

if (layers.length === 0) {
  console.error('No layers parsed from src/data/geoLayers.ts — parser drift?');
  process.exit(2);
}

let failures = 0;
for (const { id, pmtiles, sourceLayer } of layers) {
  const file = join(root, 'public', pmtiles.replace(/^\//, ''));
  if (!existsSync(file)) {
    console.error(`✗ ${id}: tile missing on disk (${pmtiles})`);
    failures++;
    continue;
  }
  let meta;
  try {
    const out = execFileSync('pmtiles', ['show', file, '--metadata'], { encoding: 'utf8' });
    meta = JSON.parse(out);
  } catch (e) {
    console.error(`✗ ${id}: could not read metadata (${e.message})`);
    failures++;
    continue;
  }
  const vectorLayers = (meta.vector_layers ?? []).map((v) => v.id);
  if (!vectorLayers.includes(sourceLayer)) {
    console.error(
      `✗ ${id}: registry sourceLayer '${sourceLayer}' NOT in tile. ` +
        `Tile has: [${vectorLayers.join(', ')}]`,
    );
    failures++;
  } else {
    console.log(`✓ ${id}: sourceLayer '${sourceLayer}' matches tile`);
  }
}

if (failures) {
  console.error(`\n${failures} layer(s) have a sourceLayer mismatch.`);
  process.exit(1);
}
console.log(`\nAll ${layers.length} layers: registry sourceLayer matches the tile. ✓`);

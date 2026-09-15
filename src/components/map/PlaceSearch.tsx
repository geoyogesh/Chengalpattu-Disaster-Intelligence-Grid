import { useMemo, useState } from 'react';
import { AutoComplete, Input } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import type { Map as MapLibreMap } from 'maplibre-gl';

import { GEO_LAYERS } from '@/data/geoLayers';

interface Hit {
  value: string;
  label: string;
  center: [number, number];
}

/** Property names that hold a human place/facility name across our sources. */
const NAME_FIELDS = ['name', 'VILLAGE', 'TEHSIL', 'wbname', 'dtname', 'facility_name', 'amenity'];

function featureName(props: Record<string, unknown>): string | null {
  for (const f of NAME_FIELDS) {
    const v = props[f];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function centroid(geom: GeoJSON.Geometry): [number, number] | null {
  const flat: number[][] = [];
  const walk = (c: unknown): void => {
    if (Array.isArray(c) && typeof c[0] === 'number') flat.push(c as number[]);
    else if (Array.isArray(c)) c.forEach(walk);
  };
  if ('coordinates' in geom) walk(geom.coordinates);
  if (!flat.length) return null;
  const sx = flat.reduce((a, p) => a + p[0], 0) / flat.length;
  const sy = flat.reduce((a, p) => a + p[1], 0) / flat.length;
  return [sx, sy];
}

/**
 * Place / facility search. Ant Design AutoComplete over the names present in
 * the currently-loaded vector tiles (villages, taluks, water bodies,
 * facilities). Selecting a result flies the map to it. This is the key
 * flood-responder affordance the old UI lacked: find a place fast.
 */
export function PlaceSearch({ map, size = 'middle' }: { map: MapLibreMap | null; size?: 'middle' | 'large' }) {
  const [options, setOptions] = useState<Hit[]>([]);

  // Layer ids whose tiles carry useful searchable names.
  const searchLayers = useMemo(
    () => GEO_LAYERS.filter((l) => ['villages', 'subdistricts', 'district', 'waterbodies', 'healthcare', 'education'].includes(l.id)),
    [],
  );

  const search = (q: string) => {
    if (!map || q.trim().length < 2) {
      setOptions([]);
      return;
    }
    const needle = q.toLowerCase();
    const seen = new Set<string>();
    const hits: Hit[] = [];
    for (const layer of searchLayers) {
      const srcLayer = `src-${layer.id}`;
      let feats: GeoJSON.Feature[] = [];
      try {
        feats = map.querySourceFeatures(srcLayer, { sourceLayer: layer.sourceLayer }) as unknown as GeoJSON.Feature[];
      } catch {
        continue;
      }
      for (const f of feats) {
        const name = featureName((f.properties ?? {}) as Record<string, unknown>);
        if (!name || !name.toLowerCase().includes(needle)) continue;
        const key = `${name}|${layer.id}`;
        if (seen.has(key)) continue;
        const c = f.geometry ? centroid(f.geometry) : null;
        if (!c) continue;
        seen.add(key);
        hits.push({ value: key, label: `${name} · ${layer.label}`, center: c });
        if (hits.length >= 20) break;
      }
      if (hits.length >= 20) break;
    }
    setOptions(hits);
  };

  const pick = (value: string) => {
    const hit = options.find((o) => o.value === value);
    if (hit && map) map.flyTo({ center: hit.center, zoom: 13 });
  };

  return (
    <AutoComplete
      options={options.map((o) => ({ value: o.value, label: o.label }))}
      onSearch={search}
      onSelect={pick}
      style={{ width: '100%' }}
      allowClear
      notFoundContent={null}
    >
      <Input
        size={size}
        prefix={<SearchOutlined />}
        placeholder="Search a village, taluk or facility…"
        aria-label="Search places"
      />
    </AutoComplete>
  );
}

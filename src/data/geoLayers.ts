/**
 * Layer registry - the single source of truth mapping each shipped PMTiles
 * archive to its MapLibre render style and its downloadable shapefile ZIP.
 *
 * Generated to match scripts/layers.manifest + the actual vector-layer names
 * inside each clipped .pmtiles (read via `pmtiles show --metadata`).
 *
 * Data (c) yashveeeeeeer/india-geodata, CC-BY-4.0, clipped to Chengalpattu.
 */

export type LayerGeom = 'fill' | 'line' | 'circle';

export interface GeoLayer {
  /** Stable id: matches the pmtiles/shapefile filenames and the store keys. */
  id: string;
  /** Human label shown in the layer panel + legend. */
  label: string;
  geom: LayerGeom;
  /** Path to the bundled PMTiles under /public. */
  pmtiles: string;
  /** Internal vector-layer name inside the PMTiles (source-layer). */
  sourceLayer: string;
  /** Path to the downloadable shapefile ZIP under /public. */
  download: string;
  /** Hex color for the rendered layer + legend swatch. */
  color: string;
  /** Whether the layer is visible on first load. */
  defaultVisible: boolean;
  /**
   * Optional feature property to render as a text label (adds a symbol layer).
   * Omit for layers that should not show labels.
   */
  labelField?: string;
  /**
   * Optional dedicated centroid POINT tileset for labels (one point per
   * feature). When set, the symbol layer reads from here instead of the
   * polygon source, so each name is drawn exactly once.
   */
  labelPmtiles?: string;
  labelSourceLayer?: string;
  /** Only show labels at/above this zoom (for dense layers like villages). */
  labelMinZoom?: number;
  /**
   * If true, do NOT render an always-on label layer; instead show the feature's
   * name on hover only (for dense reference layers like villages).
   */
  hoverLabel?: boolean;
  /**
   * For point (circle) layers: render as a symbol with this registered icon
   * image id instead of a plain circle (e.g. a hospital cross, a school glyph).
   */
  icon?: string;
  /**
   * If true, this layer is part of the "Admin boundaries" group. The group has
   * a single panel toggle; which member actually draws is chosen by zoom via
   * adminZoomBelow (district shows below this zoom, taluks at/above it).
   */
  adminGroup?: boolean;
  /** Visual TOC group (panel only; does NOT change map draw order). */
  group: LayerGroupId;
  /**
   * The PMTiles archive's real max tile zoom. The source is declared with this
   * so MapLibre OVERZOOMS beyond it rather than requesting non-existent higher
   * tiles (which blanks the layer). Must match the tile's actual max zoom.
   */
  tileMaxZoom: number;
  attribution: string;
}

/** Below this zoom the district boundary shows; at/above it, the taluks show. */
export const ADMIN_ZOOM_SWITCH = 10;

/**
 * Visual grouping for the layer panel (TOC) ONLY. This does NOT affect map
 * draw order — layers still render in GEO_LAYERS array order. It only controls
 * how the panel buckets the toggles under labeled, collapsible sections.
 */
export type LayerGroupId = 'flood' | 'response' | 'access' | 'reference';

export interface LayerGroup {
  id: LayerGroupId;
  label: string;
  /** Panel section starts expanded? */
  defaultOpen: boolean;
}

/** TOC section order (top -> bottom in the panel). Flood first, reference last. */
export const LAYER_GROUPS: LayerGroup[] = [
  { id: 'flood', label: 'Flood & Water', defaultOpen: true },
  { id: 'response', label: 'Response & Relief', defaultOpen: true },
  { id: 'access', label: 'Access & Evacuation', defaultOpen: false },
  { id: 'reference', label: 'Reference', defaultOpen: false },
];

export const GEO_LAYERS: GeoLayer[] = [
  {
    id: 'district',
    label: 'District boundary',
    group: 'reference',
    tileMaxZoom: 10,
    geom: 'fill',
    pmtiles: '/tiles/district.pmtiles',
    sourceLayer: 'Districts_2011',
    download: '/downloads/district.shp.zip',
    color: '#8c8c8c',
    defaultVisible: true,
    adminGroup: true,
    labelField: 'name',
    labelPmtiles: '/tiles/district_labels.pmtiles',
    labelSourceLayer: 'district_labels',
    attribution: 'LGD / Census 2011',
  },
  {
    id: 'subdistricts',
    label: 'Taluks (sub-districts)',
    group: 'reference',
    tileMaxZoom: 12,
    geom: 'fill',
    pmtiles: '/tiles/subdistricts.pmtiles',
    sourceLayer: 'subdistricts',
    download: '/downloads/subdistricts.shp.zip',
    color: '#40a9ff',
    defaultVisible: true,
    adminGroup: true,
    labelField: 'name',
    labelPmtiles: '/tiles/subdistricts_labels.pmtiles',
    labelSourceLayer: 'subdistricts_labels',
    attribution: 'Survey of India',
  },
  {
    id: 'villages',
    label: 'Villages',
    group: 'reference',
    tileMaxZoom: 13,
    geom: 'fill',
    pmtiles: '/tiles/villages.pmtiles',
    sourceLayer: 'villages',
    download: '/downloads/villages.shp.zip',
    color: '#8a8a8a',
    defaultVisible: false,
    labelField: 'name',
    hoverLabel: true,
    attribution: 'Survey of India villages',
  },
  {
    id: 'watersheds',
    label: 'Watersheds',
    group: 'flood',
    tileMaxZoom: 11,
    geom: 'fill',
    pmtiles: '/tiles/watersheds.pmtiles',
    sourceLayer: 'wris_watershed',
    download: '/downloads/watersheds.shp.zip',
    color: '#237804',
    defaultVisible: false,
    attribution: 'WRIS',
  },
  {
    id: 'waterbodies',
    label: 'Water bodies (tanks/eris)',
    group: 'flood',
    tileMaxZoom: 12,
    geom: 'fill',
    pmtiles: '/tiles/waterbodies.pmtiles',
    sourceLayer: 'wris_waterbodies',
    download: '/downloads/waterbodies.shp.zip',
    color: '#1677ff',
    defaultVisible: true,
    attribution: 'WRIS',
  },
  {
    id: 'tanks',
    label: 'Tanks (SOI)',
    group: 'flood',
    tileMaxZoom: 12,
    geom: 'fill',
    pmtiles: '/tiles/tanks.pmtiles',
    sourceLayer: 'SOI_Tanks',
    download: '/downloads/tanks.shp.zip',
    color: '#0958d9',
    defaultVisible: false,
    attribution: 'Survey of India',
  },
  {
    id: 'rivers',
    label: 'Rivers & streams',
    group: 'flood',
    tileMaxZoom: 12,
    geom: 'line',
    pmtiles: '/tiles/rivers.pmtiles',
    sourceLayer: 'WRIS_Rivers',
    download: '/downloads/rivers.shp.zip',
    color: '#13c2c2',
    defaultVisible: true,
    attribution: 'WRIS',
  },
  {
    id: 'roads',
    label: 'Roads',
    group: 'access',
    tileMaxZoom: 14,
    geom: 'line',
    pmtiles: '/tiles/roads.pmtiles',
    sourceLayer: 'roads',
    download: '/downloads/roads.shp.zip',
    color: '#fa8c16',
    defaultVisible: false,
    attribution: 'Survey of India',
  },
  {
    id: 'railtracks',
    label: 'Railway tracks',
    group: 'access',
    tileMaxZoom: 11,
    geom: 'line',
    pmtiles: '/tiles/railtracks.pmtiles',
    sourceLayer: 'ir_tracks',
    download: '/downloads/railtracks.shp.zip',
    color: '#9254de',
    defaultVisible: false,
    attribution: 'Indian Railways',
  },
  {
    id: 'railstations',
    label: 'Railway stations',
    group: 'access',
    tileMaxZoom: 11,
    geom: 'circle',
    pmtiles: '/tiles/railstations.pmtiles',
    sourceLayer: 'ir_stations',
    download: '/downloads/railstations.shp.zip',
    color: '#7048e8',
    defaultVisible: false,
    icon: 'icon-rail',
    attribution: 'Indian Railways',
  },
  {
    id: 'healthcare',
    label: 'Healthcare facilities',
    group: 'response',
    tileMaxZoom: 12,
    geom: 'circle',
    pmtiles: '/tiles/healthcare.pmtiles',
    sourceLayer: 'healthcare',
    download: '/downloads/healthcare.shp.zip',
    color: '#f5222d',
    defaultVisible: false,
    icon: 'icon-hospital',
    attribution: 'NIC HealthGIS',
  },
  {
    id: 'education',
    label: 'Schools (relief shelters)',
    group: 'response',
    tileMaxZoom: 12,
    geom: 'circle',
    pmtiles: '/tiles/education.pmtiles',
    sourceLayer: 'education',
    download: '/downloads/education.shp.zip',
    color: '#52c41a',
    defaultVisible: false,
    icon: 'icon-school',
    attribution: 'OpenStreetMap',
  },
];

/** Combined all-layers shapefile bundle for one-click distribution. */
export const ALL_LAYERS_DOWNLOAD = '/downloads/all-layers.zip';

// True Chengalpattu district centre (from the taluk polygons), so the district
// sits centred in the initial view rather than at a bbox corner.
export const CHENGALPATTU_CENTER: [number, number] = [79.95, 12.64];
export const CHENGALPATTU_ZOOM = 10;

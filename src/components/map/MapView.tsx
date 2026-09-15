import { Component, createRef } from 'react';
import maplibregl, { type Map as MapLibreMap } from 'maplibre-gl';

import { ensurePmtilesProtocol, registerIcons, OSM_RASTER_STYLE } from '@/components/map/mapSetup';
import { MapController, type LayerUIState } from '@/components/map/MapController';

export type { LayerUIState };

export interface MapViewProps {
  center: [number, number];
  zoom: number;
  /** Keyed by layer id -> UI state (visibility + opacity). */
  layerState: Record<string, LayerUIState>;
  /** Called with the map instance once it has loaded (for overlay controls). */
  onMapReady?: (map: MapLibreMap) => void;
}

/**
 * Thin React lifecycle glue around a long-lived MapLibre instance. All the
 * imperative map wiring (sources, layers, labels, hover, state diffing) lives
 * in the framework-agnostic MapController, which is unit-testable without React
 * or a real map. This component only:
 *   - mount:  create the map + controller, add layers on load
 *   - update: diff layerState through the controller
 *   - unmount: dispose the map
 */
export class MapView extends Component<MapViewProps> {
  private readonly containerRef = createRef<HTMLDivElement>();
  private map: MapLibreMap | null = null;
  private controller: MapController | null = null;

  override componentDidMount(): void {
    if (!this.containerRef.current) return;
    ensurePmtilesProtocol();

    const map = new maplibregl.Map({
      container: this.containerRef.current,
      style: OSM_RASTER_STYLE,
      center: this.props.center,
      zoom: this.props.zoom,
      minZoom: 4,
      maxZoom: 18,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

    map.on('error', (e) => {
      console.error('[MapLibre error]', e.error?.message ?? e.error ?? e);
    });

    const controller = new MapController(map);

    map.on('load', () => {
      void registerIcons(map).then(() => {
        controller.addGeoLayers();
        controller.applyLayerState(this.props.layerState);
        controller.setupHoverLabels();
        (window as unknown as { __map?: MapLibreMap }).__map = map;
        this.props.onMapReady?.(map);
      });
    });

    // Admin boundaries switch by zoom, so re-apply visibility on zoom change.
    map.on('zoomend', () => {
      if (controller.isReady) controller.applyLayerState(this.props.layerState);
    });

    this.map = map;
    this.controller = controller;
  }

  override componentDidUpdate(prevProps: MapViewProps): void {
    if (!this.controller?.isReady) return;
    if (prevProps.layerState !== this.props.layerState) {
      this.controller.applyLayerState(this.props.layerState);
    }
  }

  override componentWillUnmount(): void {
    this.map?.remove();
    this.map = null;
    this.controller = null;
  }

  override render() {
    return (
      <div className="map-wrap">
        <div ref={this.containerRef} className="map-container" />
      </div>
    );
  }
}

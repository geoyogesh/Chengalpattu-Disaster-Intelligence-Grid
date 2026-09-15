import { useState } from 'react';
import { Button, Flex } from 'antd';
import { MenuOutlined } from '@ant-design/icons';
import type { Map as MapLibreMap } from 'maplibre-gl';

import { MapView } from '@/components/map/MapView';
import { MapControls } from '@/components/map/MapControls';
import { MapLegend } from '@/components/map/MapLegend';
import { PlaceSearch } from '@/components/map/PlaceSearch';
import { MobileTopBar } from '@/components/layout/MobileTopBar';
import { LayerSidebar, LayerDrawer } from '@/components/layout/LayerContainers';
import { useLayerStore } from '@/store/layerStore';
import { useDeviceTier } from '@/hooks/useDeviceTier';
import { CHENGALPATTU_CENTER, CHENGALPATTU_ZOOM } from '@/data/geoLayers';

/**
 * Map page — an edge-to-edge MapLibre map with themed overlays, plus the layer
 * panel in a tier-appropriate container (one shared LayerPanel body, three
 * responsive shells):
 *   desktop : fixed sidebar beside the map (LayerSidebar)
 *   tablet  : left slide-over Drawer, opened from a floating button
 *   mobile  : bottom-sheet Drawer, opened from the MobileTopBar menu button
 */
export function DashboardPage() {
  const tier = useDeviceTier();
  const layerState = useLayerStore((s) => s.layers);
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const mapArea = (
    <div style={{ position: 'relative', flex: '1 1 auto', minWidth: 0, height: '100%' }}>
      <MapView
        center={CHENGALPATTU_CENTER}
        zoom={CHENGALPATTU_ZOOM}
        layerState={layerState}
        onMapReady={setMap}
      />
      <MapControls map={map} />
      <MapLegend compact={tier === 'mobile'} />

      {/* Desktop/tablet: floating search top-left of the map. */}
      {tier !== 'mobile' && (
        <div
          style={{
            position: 'absolute',
            top: 12,
            insetInlineStart: 12,
            width: 360,
            maxWidth: '45%',
          }}
        >
          <PlaceSearch map={map} />
        </div>
      )}
    </div>
  );

  if (tier === 'desktop') {
    return (
      <Flex style={{ height: '100%' }}>
        {mapArea}
        <LayerSidebar />
      </Flex>
    );
  }

  if (tier === 'tablet') {
    return (
      <div style={{ position: 'relative', height: '100%', display: 'flex' }}>
        {mapArea}
        <Button
          type="primary"
          icon={<MenuOutlined />}
          onClick={() => setPanelOpen(true)}
          style={{ position: 'absolute', top: 12, insetInlineEnd: 64, zIndex: 3 }}
        >
          Layers
        </Button>
        <LayerDrawer placement="left" open={panelOpen} onClose={() => setPanelOpen(false)} />
      </div>
    );
  }

  // Mobile: top bar + bottom-sheet Drawer.
  return (
    <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <MobileTopBar map={map} onOpenLayers={() => setPanelOpen(true)} />
      {mapArea}
      <LayerDrawer placement="bottom" open={panelOpen} onClose={() => setPanelOpen(false)} />
    </div>
  );
}

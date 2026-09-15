import { useState } from 'react';
import { Button, Drawer, Flex, Typography, theme } from 'antd';
import { MenuOutlined, DownloadOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import type { Map as MapLibreMap } from 'maplibre-gl';

import { MapView } from '@/components/map/MapView';
import { MapControls } from '@/components/map/MapControls';
import { MapLegend } from '@/components/map/MapLegend';
import { PlaceSearch } from '@/components/map/PlaceSearch';
import { LayerPanel } from '@/components/panels/LayerPanel';
import { useLayerStore } from '@/store/layerStore';
import { useDeviceTier } from '@/hooks/useDeviceTier';
import { CHENGALPATTU_CENTER, CHENGALPATTU_ZOOM } from '@/data/geoLayers';
import { BRAND_GRADIENT } from '@/styles/theme';

/**
 * Map page — edge-to-edge MapLibre map with themed overlays. The layer panel
 * container is chosen by device tier (Ant Design idiom: one shared LayerPanel
 * body, three responsive containers):
 *   desktop : fixed 320px sidebar beside the map
 *   tablet  : left slide-over Drawer, opened from a floating button
 *   mobile  : bottom-sheet Drawer, opened from the top-bar menu button
 */
export function DashboardPage() {
  const { token } = theme.useToken();
  const tier = useDeviceTier();
  const layerState = useLayerStore((s) => s.layers);
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const mapEl = (
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

  // ---- Desktop: fixed sidebar ----
  if (tier === 'desktop') {
    return (
      <Flex style={{ height: '100%' }}>
        {mapEl}
        <div
          style={{
            flex: '0 0 320px',
            height: '100%',
            padding: 16,
            background: token.colorBgContainer,
            borderInlineStart: `1px solid ${token.colorBorder}`,
            overflow: 'hidden',
          }}
        >
          <Flex align="center" justify="space-between" style={{ marginBottom: 12 }}>
            <div>
              <Typography.Title level={5} style={{ margin: 0 }}>
                Layers
              </Typography.Title>
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                Chengalpattu district
              </Typography.Text>
            </div>
          </Flex>
          <div style={{ height: 'calc(100% - 44px)' }}>
            <LayerPanel />
          </div>
        </div>
      </Flex>
    );
  }

  // ---- Tablet: left slide-over Drawer ----
  if (tier === 'tablet') {
    return (
      <div style={{ position: 'relative', height: '100%', display: 'flex' }}>
        {mapEl}
        <Button
          type="primary"
          icon={<MenuOutlined />}
          onClick={() => setPanelOpen(true)}
          style={{ position: 'absolute', top: 12, insetInlineEnd: 64, zIndex: 3 }}
        >
          Layers
        </Button>
        <Drawer
          title="Layers"
          placement="left"
          width={300}
          open={panelOpen}
          onClose={() => setPanelOpen(false)}
          styles={{ body: { padding: 16 } }}
        >
          <LayerPanel />
        </Drawer>
      </div>
    );
  }

  // ---- Mobile: top bar + bottom-sheet Drawer ----
  return (
    <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Mobile top bar: menu + brand + search + downloads. */}
      <Flex
        align="center"
        gap={8}
        style={{
          padding: 8,
          background: token.colorBgLayout,
          borderBlockEnd: `1px solid ${token.colorBorder}`,
        }}
      >
        <Button
          icon={<MenuOutlined />}
          onClick={() => setPanelOpen(true)}
          aria-label="Open layers"
          style={{ flex: '0 0 auto' }}
        />
        <div
          aria-hidden
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: BRAND_GRADIENT,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 800,
            fontSize: 12,
            flex: '0 0 auto',
          }}
        >
          C
        </div>
        <div style={{ flex: '1 1 auto', minWidth: 0 }}>
          <PlaceSearch map={map} />
        </div>
        <Link to="/downloads" aria-label="Downloads">
          <Button icon={<DownloadOutlined />} />
        </Link>
      </Flex>

      {mapEl}

      <Drawer
        title="Layers"
        placement="bottom"
        height="55%"
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        styles={{ body: { padding: 16 } }}
      >
        <LayerPanel />
      </Drawer>
    </div>
  );
}

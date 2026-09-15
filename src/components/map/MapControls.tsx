import { useState } from 'react';
import { FloatButton, Tooltip, theme } from 'antd';
import {
  PlusOutlined,
  MinusOutlined,
  AimOutlined,
  HomeOutlined,
} from '@ant-design/icons';
import type { Map as MapLibreMap } from 'maplibre-gl';

import { CHENGALPATTU_CENTER, CHENGALPATTU_ZOOM } from '@/data/geoLayers';

/**
 * Map controls as Ant Design FloatButtons (replacing MapLibre's default
 * NavigationControl DOM) so they match the app theme: zoom in/out, locate me,
 * and reset-to-Chengalpattu. Positioned by the parent overlay.
 */
export function MapControls({ map }: { map: MapLibreMap | null }) {
  const { token } = theme.useToken();
  const [locating, setLocating] = useState(false);

  const locate = () => {
    if (!map || !navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        map.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 13 });
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  return (
    <FloatButton.Group
      shape="square"
      style={{
        position: 'absolute',
        top: 12,
        insetInlineEnd: 12,
        insetInlineStart: 'auto',
      }}
    >
      <Tooltip title="Zoom in" placement="left">
        <FloatButton icon={<PlusOutlined />} onClick={() => map?.zoomIn()} />
      </Tooltip>
      <Tooltip title="Zoom out" placement="left">
        <FloatButton icon={<MinusOutlined />} onClick={() => map?.zoomOut()} />
      </Tooltip>
      <Tooltip title="Locate me" placement="left">
        <FloatButton
          icon={<AimOutlined spin={locating} style={{ color: locating ? token.colorPrimary : undefined }} />}
          onClick={locate}
        />
      </Tooltip>
      <Tooltip title="Reset to Chengalpattu" placement="left">
        <FloatButton
          icon={<HomeOutlined />}
          onClick={() => map?.flyTo({ center: CHENGALPATTU_CENTER, zoom: CHENGALPATTU_ZOOM })}
        />
      </Tooltip>
    </FloatButton.Group>
  );
}

import { Button, Flex, theme } from 'antd';
import { MenuOutlined, DownloadOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import type { Map as MapLibreMap } from 'maplibre-gl';

import { PlaceSearch } from '@/components/map/PlaceSearch';
import { BRAND_GRADIENT } from '@/styles/theme';

/**
 * Mobile top bar: layers-menu button + brand mark + place search + a link to
 * Downloads. Shown only on the mobile tier (the rail is hidden there).
 */
export function MobileTopBar({
  map,
  onOpenLayers,
}: {
  map: MapLibreMap | null;
  onOpenLayers: () => void;
}) {
  const { token } = theme.useToken();
  return (
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
        onClick={onOpenLayers}
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
  );
}

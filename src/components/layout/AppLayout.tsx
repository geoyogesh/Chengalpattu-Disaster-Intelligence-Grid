import { Layout } from 'antd';
import { Outlet } from 'react-router-dom';

import { AppRail } from './AppRail';
import { useDeviceTier } from '@/hooks/useDeviceTier';

/**
 * Responsive app frame (Option A "Ops console"). Desktop and tablet show the
 * 56px icon rail; mobile drops it (the map page renders its own top bar with a
 * menu button). The content area is edge-to-edge — no Card chrome around the
 * map — so the map is the product.
 */
export function AppLayout() {
  const tier = useDeviceTier();
  const showRail = tier !== 'mobile';

  return (
    <Layout style={{ height: '100vh', flexDirection: 'row' }}>
      {showRail && <AppRail />}
      <Layout style={{ minWidth: 0 }}>
        <Outlet />
      </Layout>
    </Layout>
  );
}

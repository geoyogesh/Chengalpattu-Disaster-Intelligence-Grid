import { Drawer, Flex, Typography, theme } from 'antd';

import { LayerPanel } from '@/components/panels/LayerPanel';

/**
 * The fixed desktop layer sidebar: a titled 320px column beside the map holding
 * the shared LayerPanel.
 */
export function LayerSidebar() {
  const { token } = theme.useToken();
  return (
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
  );
}

/**
 * The layer panel as a Drawer, used on tablet (left slide-over) and mobile
 * (bottom sheet). Placement/size differ by tier; both wrap the shared
 * LayerPanel body.
 */
export function LayerDrawer({
  placement,
  open,
  onClose,
}: {
  placement: 'left' | 'bottom';
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Drawer
      title="Layers"
      placement={placement}
      width={placement === 'left' ? 300 : undefined}
      height={placement === 'bottom' ? '55%' : undefined}
      open={open}
      onClose={onClose}
      styles={{ body: { padding: 16 } }}
    >
      <LayerPanel />
    </Drawer>
  );
}

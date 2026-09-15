import { useState } from 'react';
import { Button, Flex, Typography, theme } from 'antd';
import { UnorderedListOutlined, UpOutlined } from '@ant-design/icons';

import { GEO_LAYERS } from '@/data/geoLayers';
import { useLayerStore } from '@/store/layerStore';
import { LayerSwatch } from '@/components/panels/LayerSwatch';

/**
 * Live map legend. Lists only the layers currently visible, with a
 * geometry-matched swatch — so the legend always describes exactly what is
 * painted, never a static key. Two layers get a CLASSIFIED entry that mirrors
 * their graduated map style: water bodies show a small->large size ramp,
 * rivers show the major/minor split. Collapsible (collapsed by default on
 * mobile to preserve map area).
 *
 * Anchored bottom-RIGHT so it never collides with MapLibre's scale bar +
 * attribution, which live bottom-left.
 */
export function MapLegend({ compact = false }: { compact?: boolean }) {
  const { token } = theme.useToken();
  const layers = useLayerStore((s) => s.layers);
  const [open, setOpen] = useState(!compact);

  const visible = GEO_LAYERS.filter((l) => layers[l.id]?.visible && !l.adminGroup);
  if (visible.length === 0) return null;

  const panelStyle: React.CSSProperties = {
    position: 'absolute',
    insetInlineEnd: 12,
    bottom: 12,
    background: token.colorBgElevated,
    border: `1px solid ${token.colorBorder}`,
    borderRadius: token.borderRadiusLG,
    boxShadow: token.boxShadowSecondary,
    padding: open ? '8px 10px 10px' : '6px 10px',
    maxWidth: 210,
    zIndex: 5,
    pointerEvents: 'auto',
  };

  const label = (text: string) => (
    <Typography.Text style={{ fontSize: 11.5 }}>{text}</Typography.Text>
  );

  const renderEntry = (
    id: string,
    fallbackLabel: string,
    geom: 'fill' | 'line' | 'circle',
    color: string,
  ) => {
    // Water bodies: a graduated size ramp (matches the area-based fill style).
    if (id === 'waterbodies') {
      return (
        <Flex key={id} vertical gap={3}>
          {label('Water bodies')}
          <Flex align="center" gap={6}>
            <span
              aria-hidden
              style={{
                width: 74,
                height: 9,
                borderRadius: 3,
                background: 'linear-gradient(90deg, #3b6ea5, #2f7dd1, #1c6fd6, #0b5bc4)',
                opacity: 0.85,
              }}
            />
            <Typography.Text type="secondary" style={{ fontSize: 10 }}>
              tank → lake
            </Typography.Text>
          </Flex>
        </Flex>
      );
    }
    // Rivers: major/minor two-tone hint.
    if (id === 'rivers') {
      return (
        <Flex key={id} vertical gap={3}>
          {label('Rivers & streams')}
          <Flex align="center" gap={10}>
            <Flex align="center" gap={5}>
              <span
                aria-hidden
                style={{ width: 16, height: 3, borderRadius: 2, background: '#3bc9db' }}
              />
              <Typography.Text type="secondary" style={{ fontSize: 10 }}>
                river
              </Typography.Text>
            </Flex>
            <Flex align="center" gap={5}>
              <span
                aria-hidden
                style={{ width: 16, height: 2, borderRadius: 2, background: '#2f9e9e' }}
              />
              <Typography.Text type="secondary" style={{ fontSize: 10 }}>
                stream
              </Typography.Text>
            </Flex>
          </Flex>
        </Flex>
      );
    }
    return (
      <Flex key={id} align="center" gap={8}>
        <LayerSwatch geom={geom} color={color} />
        {label(fallbackLabel)}
      </Flex>
    );
  };

  if (!open) {
    return (
      <div style={panelStyle}>
        <Button
          type="text"
          size="small"
          icon={<UnorderedListOutlined />}
          onClick={() => setOpen(true)}
          style={{ padding: 0, height: 'auto', fontSize: 12 }}
        >
          Legend ({visible.length})
        </Button>
      </div>
    );
  }

  return (
    <div style={panelStyle}>
      <Flex
        align="center"
        justify="space-between"
        onClick={() => setOpen(false)}
        role="button"
        tabIndex={0}
        aria-label="Collapse legend"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') setOpen(false);
        }}
        style={{ marginBottom: 6, cursor: 'pointer', userSelect: 'none' }}
      >
        <Typography.Text type="secondary" style={{ fontSize: 11, letterSpacing: 0.4 }}>
          LEGEND
        </Typography.Text>
        <UpOutlined style={{ fontSize: 11, color: token.colorTextTertiary }} />
      </Flex>
      <Flex vertical gap={8}>
        {visible.map((l) => renderEntry(l.id, l.label, l.geom, l.color))}
      </Flex>
    </div>
  );
}

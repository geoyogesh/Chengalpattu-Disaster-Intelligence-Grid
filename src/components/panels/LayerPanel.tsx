import { Badge, Button, Collapse, Flex, List, Slider, Space, Switch, Tooltip, Typography, theme } from 'antd';

import { GEO_LAYERS, LAYER_GROUPS, type GeoLayer, type LayerGroupId } from '@/data/geoLayers';
import { useLayerStore } from '@/store/layerStore';
import { LayerSwatch } from './LayerSwatch';

/**
 * Layer panel / TOC — the shared control body rendered inside a sidebar
 * (desktop), a slide-over Drawer (tablet) or a bottom Drawer (mobile). It owns
 * no container chrome of its own so the responsive shell can place it anywhere.
 *
 * Ant Design idioms used here (vs the old hand-rolled ul/li + always-on
 * sliders): List for rows, Collapse for groups, Badge for the per-group "on"
 * count, theme.useToken() for every colour, and progressive disclosure — the
 * opacity Slider appears only when a layer is visible.
 *
 * Grouping is VISUAL only; it does not affect map draw order (fixed by
 * GEO_LAYERS order in MapView).
 */
export function LayerPanel() {
  const { token } = theme.useToken();
  const layers = useLayerStore((s) => s.layers);
  const toggleLayer = useLayerStore((s) => s.toggleLayer);
  const setOpacity = useLayerStore((s) => s.setOpacity);
  const showAll = useLayerStore((s) => s.showAll);
  const hideAll = useLayerStore((s) => s.hideAll);

  const byGroup = (g: LayerGroupId): GeoLayer[] =>
    GEO_LAYERS.filter((l) => l.group === g && !l.adminGroup);

  /** A single toggle row + progressive-disclosure opacity slider. */
  const renderRow = (opts: {
    key: string;
    label: string;
    geom: GeoLayer['geom'];
    color: string;
    tooltip?: string | null;
    ariaLabel: string;
  }) => {
    const ui = layers[opts.key];
    if (!ui) return null;
    const title = opts.tooltip ? (
      <Tooltip title={opts.tooltip}>
        <span>{opts.label}</span>
      </Tooltip>
    ) : (
      <span>{opts.label}</span>
    );
    return (
      <List.Item key={opts.key} style={{ padding: '8px 4px', display: 'block', borderBlockEnd: 'none' }}>
        <Flex align="center" justify="space-between" gap={8}>
          <Flex align="center" gap={9} style={{ minWidth: 0 }}>
            <LayerSwatch geom={opts.geom} color={opts.color} />
            <Typography.Text ellipsis style={{ fontSize: 13 }}>
              {title}
            </Typography.Text>
          </Flex>
          <Switch
            size="small"
            checked={ui.visible}
            onChange={(checked) => toggleLayer(opts.key, checked)}
            aria-label={opts.ariaLabel}
          />
        </Flex>
        {ui.visible && (
          <Slider
            min={0}
            max={1}
            step={0.05}
            value={ui.opacity}
            onChange={(v) => setOpacity(opts.key, v)}
            tooltip={{ formatter: (v) => `${Math.round((v ?? 0) * 100)}%` }}
            style={{ margin: '6px 2px 0' }}
          />
        )}
      </List.Item>
    );
  };

  const items = LAYER_GROUPS.map((group) => {
    const groupLayers = byGroup(group.id);
    const rows = groupLayers.map((l) =>
      renderRow({
        key: l.id,
        label: l.label,
        geom: l.geom,
        color: l.color,
        tooltip: `Source: ${l.attribution}`,
        ariaLabel: `Toggle ${l.label}`,
      }),
    );

    // The reference group also carries Admin-boundaries + Basemap controls.
    const extras =
      group.id === 'reference'
        ? [
            renderRow({
              key: 'admin',
              label: 'Admin boundaries',
              geom: 'line',
              color: '#40a9ff',
              tooltip: 'District when zoomed out, taluks when zoomed in',
              ariaLabel: 'Toggle admin boundaries',
            }),
            renderRow({
              key: 'osm',
              label: 'Basemap (OpenStreetMap)',
              geom: 'fill',
              color: '#a3b18a',
              tooltip: null,
              ariaLabel: 'Toggle basemap',
            }),
          ]
        : [];

    // Count how many controls in this group are currently on.
    const keys = [
      ...groupLayers.map((l) => l.id),
      ...(group.id === 'reference' ? ['admin', 'osm'] : []),
    ];
    const onCount = keys.filter((k) => layers[k]?.visible).length;

    return {
      key: group.id,
      label: (
        <Flex align="center" justify="space-between" style={{ paddingInlineEnd: 8 }}>
          <Typography.Text strong style={{ fontSize: 12, letterSpacing: 0.3 }}>
            {group.label}
          </Typography.Text>
          <Badge
            count={onCount}
            showZero
            color={onCount ? token.colorPrimary : token.colorTextQuaternary}
            style={{ boxShadow: 'none' }}
          />
        </Flex>
      ),
      children: (
        <List size="small" split={false} dataSource={[0]} renderItem={() => <>{[...extras, ...rows]}</>} />
      ),
    };
  });

  const defaultOpen = LAYER_GROUPS.filter((g) => g.defaultOpen).map((g) => g.id);

  return (
    <Flex vertical gap={12} style={{ height: '100%' }}>
      <Space>
        <Button size="small" type="primary" onClick={showAll}>
          Show all
        </Button>
        <Button size="small" onClick={hideAll}>
          Hide all
        </Button>
      </Space>

      <div style={{ flex: '1 1 auto', overflow: 'auto', marginInline: -8 }}>
        <Collapse defaultActiveKey={defaultOpen} size="small" bordered={false} ghost items={items} />
      </div>

      <Typography.Text type="secondary" style={{ fontSize: 11 }}>
        Data © India-Geodata (CC-BY-4.0), clipped to Chengalpattu.
      </Typography.Text>
    </Flex>
  );
}

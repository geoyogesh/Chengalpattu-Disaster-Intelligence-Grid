import { Button, Flex, List, Space, Tag, Typography, theme } from 'antd';
import { DownloadOutlined, FileZipOutlined } from '@ant-design/icons';

import { ALL_LAYERS_DOWNLOAD, GEO_LAYERS } from '@/data/geoLayers';
import { LayerSwatch } from '@/components/panels/LayerSwatch';

const withBase = (p: string) => `${import.meta.env.BASE_URL.replace(/\/$/, '')}${p}`;

/**
 * Shapefile downloads page. Self-contained (its own scroll + header) so it
 * works inside the edge-to-edge responsive shell. Data-driven from GEO_LAYERS,
 * so it always matches the layers actually shipped.
 */
export function DownloadsPage() {
  const { token } = theme.useToken();

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 'clamp(16px, 4vw, 32px)' }}>
      <div style={{ maxWidth: 820, marginInline: 'auto' }}>
        <Flex align="center" justify="space-between" wrap gap={12} style={{ marginBottom: 8 }}>
          <div>
            <Typography.Title level={4} style={{ margin: 0 }}>
              Shapefile downloads
            </Typography.Title>
            <Typography.Text type="secondary">
              ESRI Shapefile bundles, clipped to Chengalpattu district.
            </Typography.Text>
          </div>
          <Button
            type="primary"
            icon={<FileZipOutlined />}
            href={withBase(ALL_LAYERS_DOWNLOAD)}
            download
          >
            Download all layers
          </Button>
        </Flex>

        <List
          style={{
            marginTop: 16,
            background: token.colorBgContainer,
            border: `1px solid ${token.colorBorder}`,
            borderRadius: token.borderRadiusLG,
          }}
          itemLayout="horizontal"
          dataSource={GEO_LAYERS}
          renderItem={(layer) => (
            <List.Item
              style={{ paddingInline: 16 }}
              actions={[
                <Button
                  key="dl"
                  icon={<DownloadOutlined />}
                  href={withBase(layer.download)}
                  download
                  size="small"
                >
                  Shapefile
                </Button>,
              ]}
            >
              <List.Item.Meta
                title={
                  <Space>
                    <LayerSwatch geom={layer.geom} color={layer.color} />
                    {layer.label}
                    <Tag>{layer.geom}</Tag>
                  </Space>
                }
                description={`Source: ${layer.attribution}`}
              />
            </List.Item>
          )}
        />

        <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 16 }}>
          Data © India-Geodata (CC-BY-4.0).
        </Typography.Paragraph>
      </div>
    </div>
  );
}

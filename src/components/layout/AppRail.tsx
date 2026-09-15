import { Flex, Tooltip, theme } from 'antd';
import { CompassOutlined, DownloadOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { Link, useLocation } from 'react-router-dom';

import { BRAND_GRADIENT } from '@/styles/theme';

/**
 * The 56px icon rail (desktop + tablet). Brand mark on top, primary nav below,
 * an info affordance pinned to the bottom. Replaces the wide AntD Sider so the
 * map gets maximum width.
 */
export function AppRail() {
  const { token } = theme.useToken();
  const { pathname } = useLocation();
  const active = pathname.startsWith('/downloads') ? '/downloads' : '/map';

  const item = (to: string, icon: React.ReactNode, label: string) => {
    const isActive = active === to;
    return (
      <Tooltip title={label} placement="right">
        <Link
          to={to}
          aria-label={label}
          style={{
            width: 40,
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: token.borderRadius,
            fontSize: 17,
            color: isActive ? token.colorPrimary : token.colorTextTertiary,
            background: isActive ? token.colorBgElevated : 'transparent',
            boxShadow: isActive ? `inset 2px 0 0 ${token.colorPrimary}` : 'none',
          }}
        >
          {icon}
        </Link>
      </Tooltip>
    );
  };

  return (
    <Flex
      vertical
      align="center"
      gap={6}
      style={{
        width: 56,
        height: '100%',
        paddingBlock: 12,
        background: token.colorBgLayout,
        borderInlineEnd: `1px solid ${token.colorBorder}`,
      }}
    >
      <div
        aria-hidden
        style={{
          width: 34,
          height: 34,
          borderRadius: 9,
          background: BRAND_GRADIENT,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontWeight: 800,
          fontSize: 13,
          marginBottom: 8,
        }}
      >
        C
      </div>
      {item('/map', <CompassOutlined />, 'Map')}
      {item('/downloads', <DownloadOutlined />, 'Downloads')}
      <div style={{ marginTop: 'auto' }}>
        <Tooltip title="Data © India-Geodata (CC-BY-4.0)" placement="right">
          <InfoCircleOutlined style={{ color: token.colorTextQuaternary, fontSize: 15 }} />
        </Tooltip>
      </div>
    </Flex>
  );
}

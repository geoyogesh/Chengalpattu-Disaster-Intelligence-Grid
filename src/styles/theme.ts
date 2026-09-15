import type { ThemeConfig } from 'antd';
import { theme as antdTheme } from 'antd';

/**
 * Single source of truth for the app's Ant Design theme. Consumed by the root
 * ConfigProvider (see main.tsx). Everything visual should derive from these
 * tokens via `theme.useToken()` rather than hardcoded hex, so a token change
 * propagates everywhere and nothing drifts from the palette.
 */
export const cdigTheme: ThemeConfig = {
  algorithm: antdTheme.darkAlgorithm,
  token: {
    colorPrimary: '#1677ff',
    borderRadius: 8,
    // Slightly deeper, cooler surfaces than the default dark algorithm so the
    // map (the hero) reads as the brightest thing on screen.
    colorBgLayout: '#0b0d10',
    colorBgContainer: '#141821',
    colorBgElevated: '#1a1f2b',
    colorBorder: '#262d3a',
    colorBorderSecondary: '#1f2531',
    fontSize: 14,
  },
  components: {
    Layout: {
      headerBg: '#0e1218',
      siderBg: '#0e1218',
      bodyBg: '#0b0d10',
    },
    Menu: {
      darkItemBg: '#0e1218',
      darkItemSelectedBg: '#1a1f2b',
    },
    Card: {
      colorBgContainer: '#141821',
    },
    Drawer: {
      colorBgElevated: '#141821',
    },
  },
};

/** The CDIG brand gradient (rail logo, brand mark). */
export const BRAND_GRADIENT = 'linear-gradient(135deg, #1677ff, #0d47a1)';

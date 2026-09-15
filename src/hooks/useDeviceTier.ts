import { Grid } from 'antd';

/**
 * Responsive tier derived from Ant Design's breakpoint hook — the single place
 * that decides desktop / tablet / mobile so every component agrees.
 *
 *   desktop : >= lg (992px)  — icon rail + fixed layer sidebar
 *   tablet  : md–lg (768px)  — icon rail + slide-over Drawer
 *   mobile  : < md           — top bar + bottom-sheet Drawer
 */
export type DeviceTier = 'mobile' | 'tablet' | 'desktop';

export function useDeviceTier(): DeviceTier {
  const screens = Grid.useBreakpoint();
  if (screens.lg) return 'desktop';
  if (screens.md) return 'tablet';
  return 'mobile';
}

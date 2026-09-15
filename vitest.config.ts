import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

/**
 * Vitest config for FAST unit tests of pure logic (store reducers, the admin
 * zoom-switch rule, breakpoint mapping, style opacity builders). Scoped to
 * `src/**\/*.test.ts(x)` so it never collides with the Playwright E2E suite,
 * which owns `tests/*.spec.ts` and runs the real browser.
 */
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    globals: true,
  },
});

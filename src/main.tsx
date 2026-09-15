import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { App as AntApp, ConfigProvider } from 'antd';

import { router } from '@/router';
import { cdigTheme } from '@/styles/theme';

import 'antd/dist/reset.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import '@/styles/global.css';

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Root element #root not found');
}

createRoot(rootEl).render(
  <StrictMode>
    <ConfigProvider theme={cdigTheme}>
      <AntApp>
        <RouterProvider router={router} />
      </AntApp>
    </ConfigProvider>
  </StrictMode>,
);

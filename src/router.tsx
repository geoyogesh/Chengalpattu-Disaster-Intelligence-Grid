import { createBrowserRouter, Navigate } from 'react-router-dom';

import { AppLayout } from '@/components/layout/AppLayout';
import { DashboardPage } from '@/pages/DashboardPage';
import { DownloadsPage } from '@/components/panels/DownloadsPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/map" replace /> },
      { path: 'map', element: <DashboardPage /> },
      { path: 'downloads', element: <DownloadsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

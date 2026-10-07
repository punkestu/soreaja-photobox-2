/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useSearchParams,
  useLocation,
} from 'react-router-dom';
import { PhotoboxProvider } from './context/PhotoboxContext';
import { AdminLayout } from './components/admin/AdminLayout';
import { AdminWelcome } from './pages/admin/AdminWelcome';
import { AdminSettings } from './pages/admin/AdminSettings';
import { AdminLaunch } from './pages/admin/AdminLaunch';
import { KioskLayout } from './components/kiosk/KioskLayout';
import { IdleScreen } from './pages/kiosk/IdleScreen';
import { FrameSelectionScreen } from './pages/kiosk/FrameSelectionScreen';
import { CameraCaptureScreen } from './pages/kiosk/CameraCaptureScreen';
import { ReviewPhotosScreen } from './pages/kiosk/ReviewPhotosScreen';
import { FinalPreviewScreen } from './pages/kiosk/FinalPreviewScreen';
import { PrintResultScreen } from './pages/kiosk/PrintResultScreen';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { applyThemeColor } from './data/themeConfig';

const LAST_ROUTE_KEY = 'soreaja_last_active_route';

const ThemeWatcher: React.FC = () => {
  const settings = useLiveQuery(() => db.settings.get('app_settings'), []);

  useEffect(() => {
    applyThemeColor(settings?.themeColor || '#E11D48');
  }, [settings?.themeColor]);

  return null;
};

const getSavedRoute = (): string | null => {
  try {
    const saved =
      localStorage.getItem(LAST_ROUTE_KEY) ||
      sessionStorage.getItem(LAST_ROUTE_KEY);
    if (saved && saved !== '/' && saved.startsWith('/')) {
      return saved;
    }
  } catch {
    // Ignore storage access errors
  }
  return null;
};

// Tracks the current page on every navigation so refreshing preserves the exact view
const RouteTracker: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    if (location.pathname && location.pathname !== '/') {
      const fullPath = location.pathname + location.search + location.hash;
      try {
        localStorage.setItem(LAST_ROUTE_KEY, fullPath);
        sessionStorage.setItem(LAST_ROUTE_KEY, fullPath);
      } catch {
        // Ignore storage access errors
      }
    }
  }, [location]);

  return null;
};

const RootRedirect: React.FC = () => {
  const [searchParams] = useSearchParams();
  if (searchParams.get('autostart') === '1') {
    return <Navigate to="/app/frame-selection" replace />;
  }

  const savedRoute = getSavedRoute();
  if (savedRoute) {
    return <Navigate to={savedRoute} replace />;
  }

  return <Navigate to="/admin/welcome" replace />;
};

const FallbackRedirect: React.FC = () => {
  const savedRoute = getSavedRoute();
  if (savedRoute) {
    return <Navigate to={savedRoute} replace />;
  }
  return <Navigate to="/admin/welcome" replace />;
};

export default function App() {
  return (
    <PhotoboxProvider>
      <ThemeWatcher />
      <BrowserRouter>
        <RouteTracker />
        <Routes>
          <Route path="/" element={<RootRedirect />} />

          {/* Fase 1: Dashboard (/admin) */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/welcome" replace />} />
            <Route path="welcome" element={<AdminWelcome />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="launch" element={<AdminLaunch />} />
          </Route>

          {/* Fase 2: Sesi Photobox (/app) */}
          <Route path="/app" element={<KioskLayout />}>
            <Route index element={<Navigate to="/app/idle" replace />} />
            <Route path="idle" element={<IdleScreen />} />
            <Route path="frame-selection" element={<FrameSelectionScreen />} />
            <Route path="camera" element={<CameraCaptureScreen />} />
            <Route path="review-photos" element={<ReviewPhotosScreen />} />
            <Route path="preview-final" element={<FinalPreviewScreen />} />
            <Route path="print-result" element={<PrintResultScreen />} />
          </Route>

          <Route path="*" element={<FallbackRedirect />} />
        </Routes>
      </BrowserRouter>
    </PhotoboxProvider>
  );
}



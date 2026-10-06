/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useSearchParams,
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

const RootRedirect: React.FC = () => {
  const [searchParams] = useSearchParams();
  if (searchParams.get('autostart') === '1') {
    return <Navigate to="/app/frame-selection" replace />;
  }
  return <Navigate to="/admin/welcome" replace />;
};

export default function App() {
  return (
    <PhotoboxProvider>
      <BrowserRouter>
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

          <Route path="*" element={<Navigate to="/admin/welcome" replace />} />
        </Routes>
      </BrowserRouter>
    </PhotoboxProvider>
  );
}


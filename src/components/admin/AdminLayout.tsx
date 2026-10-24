import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, ensureDefaultSettings } from '../../db';
import { fetchFramesMetadata } from '../../data/defaultFrames';
import { usePhotobox } from '../../context/PhotoboxContext';
import { PWAInstallButton } from '../common/PWAInstallButton';
import { OfflineIndicator } from '../common/OfflineIndicator';

export const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const { language, setLanguage, t, stopSessionTimer } = usePhotobox();
  const sessionCount = useLiveQuery(() => db.sessions.count(), []);
  const [frameCount, setFrameCount] = useState<number | null>(null);

  useEffect(() => {
    stopSessionTimer();
    ensureDefaultSettings();
    fetchFramesMetadata().then((data) => setFrameCount(data.length));
  }, [stopSessionTimer]);

  return (
    <div className="min-h-screen bg-[#F4F4F0] text-[#111111] flex flex-col">
      <OfflineIndicator />
      {/* Top Bar Contract: 3 Zones (Brand Wordmark — Nav Links — Primary Action + Language Toggle) */}
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-neutral-200 sticky top-0 z-30">
        <Link
          to="/admin/welcome"
          className="font-display text-lg font-bold tracking-tight text-neutral-900 whitespace-nowrap"
        >
          {t.appName}
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Admin Language Switcher Segmented Control */}
          <div
            role="group"
            aria-label="Admin Interface Language Switcher"
            className="flex items-center p-0.5 bg-neutral-100 rounded-xl border border-neutral-300 shadow-xs"
          >
            <button
              type="button"
              onClick={() => setLanguage('id')}
              aria-label="Bahasa Indonesia"
              className={`min-h-[38px] px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer active:scale-95 ${language === 'id'
                ? 'bg-neutral-900 text-white shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
                }`}
            >
              🇮🇩 ID
            </button>
            <button
              type="button"
              onClick={() => setLanguage('en')}
              aria-label="English"
              className={`min-h-[38px] px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer active:scale-95 ${language === 'en'
                ? 'bg-neutral-900 text-white shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
                }`}
            >
              🇬🇧 EN
            </button>
          </div>

          <PWAInstallButton variant="admin" />

          <button
            type="button"
            onClick={() => navigate('/app/idle')}
            className="min-h-[44px] px-4 py-2 text-xs sm:text-sm font-bold text-white bg-[var(--theme-accent,#E11D48)] rounded-xl hover:bg-[var(--theme-accent-hover,#BE123C)] active:scale-95 transition-all whitespace-nowrap cursor-pointer shadow-sm flex items-center gap-1.5"
          >
            <span>🚀</span>
            <span>{t.admin.navOpenKiosk}</span>
          </button>
        </div>
      </header>

      {/* Workspace Canvas: Sidebar + Main Content Viewport */}
      <div className="flex-1 flex flex-col lg:flex-row max-w-[1440px] w-full mx-auto">
        <aside
          aria-label="Sidebar Manajemen Photobox"
          className="w-full lg:w-[260px] shrink-0 bg-[#F4F4F0] border-b lg:border-b-0 lg:border-r border-neutral-200 p-4 sm:p-6 flex flex-col justify-between gap-6"
        >
          <div className="space-y-4 sm:space-y-6">
            <div>
              <p className="text-xs font-semibold text-neutral-500 mb-2.5">
                {t.admin.sidebarSystem}
              </p>
              <div className="flex lg:flex-col gap-1.5 overflow-x-auto pb-1">
                <NavLink
                  to="/admin/welcome"
                  className={({ isActive }) =>
                    `min-h-[44px] flex items-center px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap active:scale-95 ${isActive
                      ? 'bg-neutral-900 text-white shadow-sm'
                      : 'text-neutral-700 hover:bg-neutral-200/70'
                    }`
                  }
                >
                  {t.admin.summaryStatus}
                </NavLink>
                <NavLink
                  to="/admin/frames"
                  className={({ isActive }) =>
                    `min-h-[44px] flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap active:scale-95 ${isActive
                      ? 'bg-neutral-900 text-white shadow-sm'
                      : 'text-neutral-700 hover:bg-neutral-200/70'
                    }`
                  }
                >
                  <span>{t.admin.summaryFrames}</span>
                  {typeof frameCount === 'number' && (
                    <span className="ml-2 text-xs font-mono-tabular px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-600">
                      {frameCount}
                    </span>
                  )}
                </NavLink>
                <NavLink
                  to="/admin/sessions"
                  className={({ isActive }) =>
                    `min-h-[44px] flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap active:scale-95 ${isActive
                      ? 'bg-neutral-900 text-white shadow-sm'
                      : 'text-neutral-700 hover:bg-neutral-200/70'
                    }`
                  }
                >
                  <span>{t.admin.summarySessions}</span>
                  {typeof sessionCount === 'number' && (
                    <span
                      className={`ml-2 text-xs font-mono-tabular px-2 py-0.5 rounded-full ${
                        sessionCount > 0
                          ? 'bg-[var(--theme-accent,#E11D48)] text-white'
                          : 'bg-neutral-200 text-neutral-600'
                      }`}
                    >
                      {sessionCount}
                    </span>
                  )}
                </NavLink>
                <NavLink
                  to="/admin/settings"
                  className={({ isActive }) =>
                    `min-h-[44px] flex items-center px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap active:scale-95 ${isActive
                      ? 'bg-neutral-900 text-white shadow-sm'
                      : 'text-neutral-700 hover:bg-neutral-200/70'
                    }`
                  }
                >
                  {t.admin.summarySettings}
                </NavLink>
                <NavLink
                  to="/admin/launch"
                  className={({ isActive }) =>
                    `min-h-[44px] flex items-center px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap active:scale-95 ${isActive
                      ? 'bg-neutral-900 text-white shadow-sm'
                      : 'text-neutral-700 hover:bg-neutral-200/70'
                    }`
                  }
                >
                  {t.admin.summaryLaunch}
                </NavLink>
              </div>
            </div>

            <div className="pt-6 border-t border-neutral-200/80 hidden lg:block">
              <p className="text-xs font-medium text-neutral-500 mb-2">
                {t.admin.sidebarShortcuts}
              </p>
              <div className="space-y-1.5 text-xs text-neutral-600">
                <Link
                  to="/app/idle"
                  className="block py-1 hover:text-neutral-900 hover:underline"
                >
                  {t.admin.sidebarIdle}
                </Link>
                <Link
                  to="/app/frame-selection"
                  className="block py-1 hover:text-neutral-900 hover:underline"
                >
                  {t.admin.sidebarFrame}
                </Link>
                <Link
                  to="/app/camera"
                  className="block py-1 hover:text-neutral-900 hover:underline"
                >
                  {t.admin.sidebarCamera}
                </Link>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-neutral-200/80 text-xs text-neutral-500 space-y-1">
            <p className="font-semibold text-neutral-800">{t.admin.offlineReady}</p>
            <p>{t.admin.offlineReadyDesc}</p>
          </div>
        </aside>

        <main className="flex-1 p-6 md:p-10 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

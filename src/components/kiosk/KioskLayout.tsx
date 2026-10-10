import React, { useEffect, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { usePhotobox } from '../../context/PhotoboxContext';
import { PWAInstallButton } from '../common/PWAInstallButton';
import { OfflineIndicator } from '../common/OfflineIndicator';

const STEPS = [
  { path: '/app/idle', label: '01. Mulai' },
  { path: '/app/frame-selection', label: '02. Bingkai' },
  { path: '/app/camera', label: '03. Kamera' },
  { path: '/app/review-photos', label: '04. Evaluasi' },
  { path: '/app/preview-final', label: '05. Hasil Frame' },
  { path: '/app/print-result', label: '06. Cetak & QR' },
];

export const KioskLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { resetSession } = usePhotobox();
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.warn('Fullscreen request failed:', err);
    }
  };

  const handleRestart = () => {
    resetSession();
    navigate('/app/idle');
  };

  const isIdleScreen = location.pathname === '/app/idle';

  return (
    <div className="min-h-screen w-full bg-[#0A0A0B] text-[#F4F4F0] flex flex-col overflow-x-hidden selection:bg-[var(--theme-accent,#E11D48)] selection:text-white">
      <OfflineIndicator />

      {/* Top Bar: Seamless borderless studio navigation */}
      <header
        className={`flex items-center justify-between px-4 sm:px-6 md:px-8 py-3 z-30 transition-all duration-300 ${
          isIdleScreen
            ? 'absolute top-0 left-0 right-0 bg-transparent'
            : 'sticky top-0 bg-[#0A0A0B]/95 backdrop-blur-md border-b border-white/5'
        }`}
      >
        <Link
          to="/app/idle"
          className="font-display text-lg sm:text-xl font-bold tracking-tight text-[#F4F4F0] hover:text-white whitespace-nowrap active:scale-95 transition-transform"
        >
          SoreAja — Photobox
        </Link>

        {!isIdleScreen && (
          <div
            aria-label="Tahapan Sesi Photobox"
            className="flex items-center gap-2 sm:gap-3 text-xs font-mono-tabular select-none"
          >
            {/* Tablet Step Tracker: Segmented Track & Active Label */}
            <div className="flex items-center gap-1.5 p-1 bg-zinc-900/80 rounded-xl border border-zinc-800/80">
              {STEPS.map((step, idx) => {
                const currentIdx = STEPS.findIndex((s) => s.path === location.pathname);
                const isCurrent = location.pathname === step.path;
                const isPassed = idx < currentIdx;
                return (
                  <div
                    key={step.path}
                    title={step.label}
                    className={`h-2 sm:h-2.5 rounded-full transition-all ${
                      isCurrent
                        ? 'w-6 sm:w-8 bg-[var(--theme-accent,#E11D48)] shadow-[0_0_8px_rgba(225,29,72,0.8)]'
                        : isPassed
                        ? 'w-2 sm:w-2.5 bg-zinc-400'
                        : 'w-2 sm:w-2.5 bg-zinc-700'
                    }`}
                  />
                );
              })}
            </div>

            <div className="hidden sm:flex items-center gap-1.5 text-zinc-300">
              <span className="font-bold text-white">
                {STEPS.find((s) => s.path === location.pathname)?.label || 'Photobox'}
              </span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Fullscreen Button - 48px Tablet Touch Target */}
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Keluar dari Layar Penuh' : 'Masuk ke Layar Penuh'}
            className="min-h-[48px] min-w-[48px] flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold text-zinc-300 hover:text-white bg-zinc-900/90 active:scale-95 hover:bg-zinc-800 rounded-xl transition-all whitespace-nowrap cursor-pointer border border-zinc-800/80 shadow-sm"
          >
            {isFullscreen ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 9H4m0 0v5m0-5l6 6m5-6h5m0 0v5m0-5l-6 6m6 5h-5m0 0v5m0-5l6-6m-11 5H4m0 0v-5m0 5l6-6" />
                </svg>
                <span className="hidden md:inline">Keluar</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
                <span className="hidden md:inline">Layar Penuh</span>
              </>
            )}
          </button>

          <PWAInstallButton variant="kiosk" />

          {!isIdleScreen && (
            <button
              type="button"
              onClick={handleRestart}
              className="min-h-[48px] px-4 py-2.5 text-xs sm:text-sm font-semibold text-zinc-300 hover:text-white bg-zinc-900/90 active:scale-95 hover:bg-zinc-800 rounded-xl transition-all whitespace-nowrap cursor-pointer border border-zinc-800/80 shadow-sm"
            >
              Ulangi
            </button>
          )}

          <Link
            to="/admin/welcome"
            className="min-h-[48px] flex items-center px-4 py-2.5 text-xs sm:text-sm font-semibold text-zinc-400 hover:text-white bg-zinc-900/60 active:scale-95 hover:bg-zinc-800 rounded-xl transition-all whitespace-nowrap border border-zinc-800/60"
          >
            Admin
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col w-full h-full">
        <Outlet />
      </main>
    </div>
  );
};

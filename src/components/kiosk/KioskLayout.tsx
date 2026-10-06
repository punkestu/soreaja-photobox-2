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
    <div className="min-h-screen w-full bg-[#0A0A0B] text-[#F4F4F0] flex flex-col overflow-x-hidden selection:bg-[#E11D48] selection:text-white">
      <OfflineIndicator />

      {/* Top Bar: Seamless borderless studio navigation */}
      <header
        className={`flex items-center justify-between px-6 py-3.5 z-30 transition-all duration-300 ${
          isIdleScreen
            ? 'absolute top-0 left-0 right-0 bg-transparent'
            : 'sticky top-0 bg-[#0A0A0B]/95 backdrop-blur-md'
        }`}
      >
        <Link
          to="/app/idle"
          className="font-display text-lg font-bold tracking-tight text-[#F4F4F0] hover:text-white whitespace-nowrap"
        >
          SoreAja — Photobox
        </Link>

        {!isIdleScreen && (
          <nav
            aria-label="Tahapan Sesi Photobox"
            className="hidden lg:flex items-center gap-6 text-xs font-mono-tabular"
          >
            {STEPS.slice(0, 5).map((step) => {
              const isCurrent = location.pathname === step.path;
              return (
                <span
                  key={step.path}
                  className={`whitespace-nowrap transition-colors ${
                    isCurrent
                      ? 'text-[#F4F4F0] font-semibold border-b-2 border-[#E11D48] pb-0.5'
                      : 'text-zinc-500'
                  }`}
                >
                  {step.label}
                </span>
              );
            })}
          </nav>
        )}

        <div className="flex items-center gap-2.5">
          {/* Fullscreen Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Keluar dari Layar Penuh' : 'Masuk ke Layar Penuh'}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-white bg-zinc-900/80 hover:bg-zinc-800 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            {isFullscreen ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 9H4m0 0v5m0-5l6 6m5-6h5m0 0v5m0-5l-6 6m6 5h-5m0 0v5m0-5l6-6m-11 5H4m0 0v-5m0 5l6-6" />
                </svg>
                <span>Keluar Layar Penuh</span>
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
                <span>Layar Penuh</span>
              </>
            )}
          </button>

          <PWAInstallButton variant="kiosk" />

          {!isIdleScreen && (
            <button
              type="button"
              onClick={handleRestart}
              className="px-3.5 py-1.5 text-xs font-medium text-zinc-300 hover:text-white bg-zinc-900/80 hover:bg-zinc-800 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              Ulangi Sesi
            </button>
          )}

          <Link
            to="/admin/welcome"
            className="px-3.5 py-1.5 text-xs font-medium text-zinc-400 hover:text-white bg-zinc-900/50 hover:bg-zinc-800 rounded-lg transition-colors whitespace-nowrap"
          >
            Panel Admin
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col w-full h-full">
        <Outlet />
      </main>
    </div>
  );
};

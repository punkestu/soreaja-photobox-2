import React, { useEffect, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { usePhotobox } from '../../context/PhotoboxContext';
import { PWAInstallButton } from '../common/PWAInstallButton';
import { OfflineIndicator } from '../common/OfflineIndicator';

export const KioskLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    resetSession,
    language,
    setLanguage,
    t,
    sessionSecondsLeft,
    isSessionTimerEnabled,
    isSessionExpiredAlertOpen,
    dismissSessionExpiredAlert,
    startSessionTimer,
  } = usePhotobox();
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const steps = [
    { path: '/app/idle', label: t.steps.step1 },
    { path: '/app/frame-selection', label: t.steps.step2 },
    { path: '/app/camera', label: t.steps.step3 },
    { path: '/app/review-photos', label: t.steps.step4 },
    { path: '/app/preview-final', label: t.steps.step5 },
    { path: '/app/print-result', label: t.steps.step6 },
  ];

  const isIdleScreen = location.pathname === '/app/idle';

  // Automatically initiate session countdown timer when guest starts beyond idle screen
  useEffect(() => {
    if (!isIdleScreen && location.pathname.startsWith('/app/')) {
      startSessionTimer();
    }
  }, [isIdleScreen, location.pathname, startSessionTimer]);

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

  return (
    <div className="min-h-screen w-full bg-[#0A0A0B] text-[#F4F4F0] flex flex-col overflow-x-hidden selection:bg-[var(--theme-accent,#E11D48)] selection:text-white">
      <OfflineIndicator />

      {/* Top Bar: Seamless studio navigation & session monitor */}
      <header
        className={`flex items-center justify-between px-4 sm:px-6 md:px-8 py-3 z-30 transition-all duration-300 ${
          isIdleScreen
            ? 'absolute top-0 left-0 right-0 bg-transparent'
            : 'sticky top-0 bg-[#0A0A0B]/95 backdrop-blur-md border-b border-white/5'
        }`}
      >
        <div className="flex items-center gap-3 sm:gap-4">
          <Link
            to="/app/idle"
            className="font-display text-lg sm:text-xl font-bold tracking-tight text-[#F4F4F0] hover:text-white whitespace-nowrap active:scale-95 transition-transform"
          >
            {t.appName}
          </Link>

          {/* Session Countdown Timer Widget */}
          {isSessionTimerEnabled && !isIdleScreen && (
            <div
              title={t.sessionTimer.timeRemaining}
              aria-label={t.sessionTimer.timeRemaining}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-mono-tabular transition-all select-none ${
                sessionSecondsLeft === 0
                  ? 'bg-rose-950/80 border-rose-500/80 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.4)] animate-pulse'
                  : sessionSecondsLeft <= 60
                  ? 'bg-amber-950/80 border-amber-500/80 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                  : 'bg-zinc-900/90 border-zinc-800 text-zinc-300'
              }`}
            >
              <span className="text-[11px]">{sessionSecondsLeft === 0 ? '🔔' : '⏳'}</span>
              <span className="font-bold tracking-wider">
                {String(Math.floor(sessionSecondsLeft / 60)).padStart(2, '0')}:
                {String(sessionSecondsLeft % 60).padStart(2, '0')}
              </span>
            </div>
          )}
        </div>

        {!isIdleScreen && (
          <div
            aria-label={t.steps.stepIndicator}
            className="hidden md:flex items-center gap-2 sm:gap-3 text-xs font-mono-tabular select-none"
          >
            {/* Tablet Step Tracker: Segmented Track & Active Label */}
            <div className="flex items-center gap-1.5 p-1 bg-zinc-900/80 rounded-xl border border-zinc-800/80">
              {steps.map((step, idx) => {
                const currentIdx = steps.findIndex((s) => s.path === location.pathname);
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

            <div className="hidden lg:flex items-center gap-1.5 text-zinc-300">
              <span className="font-bold text-white">
                {steps.find((s) => s.path === location.pathname)?.label || 'Photobox'}
              </span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Language Switcher Segmented Control */}
          <div
            role="group"
            aria-label="Language Switcher"
            className="flex items-center p-0.5 bg-zinc-900/90 rounded-xl border border-zinc-800/80 shadow-sm"
          >
            <button
              type="button"
              onClick={() => setLanguage('id')}
              aria-label="Bahasa Indonesia"
              className={`min-h-[40px] px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer active:scale-95 ${
                language === 'id'
                  ? 'bg-[var(--theme-accent,#E11D48)] text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              🇮🇩 ID
            </button>
            <button
              type="button"
              onClick={() => setLanguage('en')}
              aria-label="English"
              className={`min-h-[40px] px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer active:scale-95 ${
                language === 'en'
                  ? 'bg-[var(--theme-accent,#E11D48)] text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              🇬🇧 EN
            </button>
          </div>

          {/* Fullscreen Button - 48px Tablet Touch Target */}
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? t.nav.exitFullscreen : t.nav.fullscreen}
            className="min-h-[46px] min-w-[46px] flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-2 text-xs sm:text-sm font-semibold text-zinc-300 hover:text-white bg-zinc-900/90 active:scale-95 hover:bg-zinc-800 rounded-xl transition-all whitespace-nowrap cursor-pointer border border-zinc-800/80 shadow-sm"
          >
            {isFullscreen ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 9H4m0 0v5m0-5l6 6m5-6h5m0 0v5m0-5l-6 6m6 5h-5m0 0v5m0-5l6-6m-11 5H4m0 0v-5m0 5l6-6" />
                </svg>
                <span className="hidden md:inline">{t.nav.exitFullscreen}</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
                <span className="hidden md:inline">{t.nav.fullscreen}</span>
              </>
            )}
          </button>

          <PWAInstallButton variant="kiosk" />

          {!isIdleScreen && (
            <button
              type="button"
              onClick={handleRestart}
              className="min-h-[46px] px-3 sm:px-3.5 py-2 text-xs sm:text-sm font-semibold text-zinc-300 hover:text-white bg-zinc-900/90 active:scale-95 hover:bg-zinc-800 rounded-xl transition-all whitespace-nowrap cursor-pointer border border-zinc-800/80 shadow-sm flex items-center gap-1.5"
              title={t.nav.reset}
            >
              <span>↺</span>
              <span className="hidden sm:inline">{t.nav.reset}</span>
            </button>
          )}

          <Link
            to="/admin/welcome"
            className="min-h-[46px] flex items-center gap-1 px-3 sm:px-3.5 py-2 text-xs sm:text-sm font-semibold text-zinc-400 hover:text-white bg-zinc-900/60 active:scale-95 hover:bg-zinc-800 rounded-xl transition-all whitespace-nowrap border border-zinc-800/60"
          >
            <span>⚙️</span>
            <span className="hidden sm:inline">{t.nav.admin}</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col w-full h-full">
        <Outlet />
      </main>

      {/* Session Expired Alert Modal (Non-destructive: alerts guest with sound, does not auto-end session) */}
      {isSessionExpiredAlertOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="session-expired-title"
            aria-describedby="session-expired-desc"
            className="bg-zinc-900 border border-[var(--theme-accent,#E11D48)]/60 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-[0_25px_60px_rgba(0,0,0,0.9),0_0_40px_rgba(225,29,72,0.3)] flex flex-col items-center text-center space-y-4"
          >
            <div className="w-16 h-16 rounded-2xl bg-[var(--theme-accent,#E11D48)]/15 border border-[var(--theme-accent,#E11D48)]/40 flex items-center justify-center text-3xl shadow-inner animate-bounce">
              ⏰
            </div>
            <div className="space-y-2">
              <h3 id="session-expired-title" className="font-display text-xl sm:text-2xl font-extrabold text-[#F4F4F0]">
                {t.sessionTimer.expiredTitle}
              </h3>
              <p id="session-expired-desc" className="text-sm text-zinc-300 leading-relaxed">
                {t.sessionTimer.expiredDesc}
              </p>
            </div>
            <button
              type="button"
              onClick={dismissSessionExpiredAlert}
              className="w-full min-h-[48px] py-3 px-6 text-sm font-bold text-white bg-[var(--theme-accent,#E11D48)] hover:bg-[var(--theme-accent-hover,#BE123C)] active:scale-95 rounded-xl transition-all shadow-lg cursor-pointer"
            >
              {t.sessionTimer.continueBtn}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

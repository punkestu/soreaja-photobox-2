import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { usePhotobox } from '../../context/PhotoboxContext';
import { KIOSK_HERO_BACKDROP } from '../../data/defaultFrames';
import { BACKDROP_PRESETS } from '../../data/themeConfig';

export const IdleScreen: React.FC = () => {
  const navigate = useNavigate();
  const { resetSession } = usePhotobox();
  const settings = useLiveQuery(() => db.settings.get('app_settings'), []);

  const handleStart = async () => {
    // Attempt fullscreen on user interaction
    if (!document.fullscreenElement) {
      try {
        await document.documentElement.requestFullscreen();
      } catch {
        // Fullscreen may be restricted in some iframes, proceed gracefully
      }
    }
    resetSession();
    navigate('/app/frame-selection');
  };

  // Resolve background photo from custom uploaded base64, URL, preset, or default hero backdrop
  const backdropSrc = React.useMemo(() => {
    const customBg = settings?.kioskBackground;
    if (!customBg) return KIOSK_HERO_BACKDROP;
    const matchedPreset = BACKDROP_PRESETS.find((p) => p.id === customBg);
    if (matchedPreset) return matchedPreset.src;
    return customBg;
  }, [settings?.kioskBackground]);

  const opacityValue = (settings?.kioskBackgroundOverlayOpacity ?? 60) / 100;
  const themeColor = settings?.themeColor || '#E11D48';

  return (
    <div
      onClick={handleStart}
      role="region"
      aria-label="Layar Mulai Sesi Photobox"
      className="flex-1 w-full min-h-screen relative flex items-center justify-center overflow-hidden cursor-pointer select-none"
    >
      {/* Editorial Studio Backdrop Image with Configurable Overlay */}
      <img
        src={backdropSrc}
        alt="Studio Photobox SoreAja"
        referrerPolicy="no-referrer"
        className="absolute inset-0 w-full h-full object-cover scale-105 transition-all duration-700"
        style={{ opacity: opacityValue }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0B] via-[#0A0A0B]/70 to-[#0A0A0B]/30" />

      <div className="relative z-10 w-full max-w-5xl mx-auto px-6 py-12 sm:py-16 md:py-20 text-center space-y-8 md:space-y-10 select-none">
        <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-4 text-xs sm:text-sm md:text-base font-mono-tabular text-zinc-300 tracking-wide">
          <span className="font-semibold text-white">{settings?.studioName || 'SoreAja Studio — Booth 02'}</span>
          <span aria-hidden="true">·</span>
          <span>{settings?.eventName || 'SoreAja Sunset Session 2026'}</span>
          <span aria-hidden="true">·</span>
          <span className="text-emerald-400 font-bold">100% Offline Ready</span>
        </div>

        <div className="space-y-4 md:space-y-6">
          <h1
            className="font-display text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold tracking-tight text-[#F4F4F0]"
            style={{ textWrap: 'balance' }}
          >
            SoreAja — Photobox
          </h1>
          <p className="font-serif-editorial italic text-2xl sm:text-3xl md:text-5xl text-zinc-200">
            Abadikan momenmu sekarang juga.
          </p>
        </div>

        <div className="pt-4 sm:pt-8 flex flex-col items-center gap-6">
          {/* Tablet First Commanding Primary Touch Action */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleStart();
            }}
            style={{
              backgroundColor: themeColor,
            }}
            className="min-h-[76px] sm:min-h-[86px] md:min-h-[96px] px-10 sm:px-16 md:px-20 py-5 sm:py-6 text-xl sm:text-2xl md:text-3xl font-display font-extrabold text-white rounded-3xl shadow-[0_0_60px_rgba(225,29,72,0.65)] transition-all duration-200 active:scale-95 whitespace-nowrap cursor-pointer hover:brightness-105 flex items-center gap-4 animate-pulse ring-2 ring-white/30"
          >
            <span className="text-2xl sm:text-3xl md:text-4xl">👉</span>
            <span>Sentuh Layar untuk Memulai</span>
          </button>

          <p className="text-xs sm:text-sm md:text-base font-mono-tabular text-zinc-300 max-w-xl">
            Pilih Bingkai · Pose Otomatis · Cetak Instan & Scan QR Google Drive
          </p>
        </div>
      </div>
    </div>
  );
};

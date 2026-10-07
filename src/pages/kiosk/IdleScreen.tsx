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

      <div className="relative z-10 w-full max-w-5xl mx-auto px-6 py-16 text-center space-y-8">
        <div className="flex items-center justify-center gap-3 text-xs font-mono-tabular text-zinc-300 tracking-wide">
          <span>{settings?.studioName || 'SoreAja Studio — Booth 02'}</span>
          <span aria-hidden="true">·</span>
          <span>{settings?.eventName || 'SoreAja Sunset Session 2026'}</span>
          <span aria-hidden="true">·</span>
          <span>Mode Offline Mandiri</span>
        </div>

        <div className="space-y-4">
          <h1
            className="font-display text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-[#F4F4F0]"
            style={{ textWrap: 'balance' }}
          >
            SoreAja — Photobox
          </h1>
          <p className="font-serif-editorial italic text-2xl sm:text-3xl text-zinc-300">
            Abadikan momenmu sekarang juga.
          </p>
        </div>

        <div className="pt-4 flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleStart();
            }}
            style={{
              backgroundColor: themeColor,
            }}
            className="px-12 py-5 text-base sm:text-lg font-display font-bold text-white rounded-2xl shadow-2xl transition-all duration-200 active:scale-95 whitespace-nowrap cursor-pointer hover:brightness-95 hover:shadow-[0_0_35px_rgba(255,255,255,0.2)]"
          >
            Sentuh untuk Memulai
          </button>

          <p className="text-xs font-mono-tabular text-zinc-400">
            Pilih Bingkai · Pose Otomatis · Cetak Instan & Scan QR Google Drive
          </p>
        </div>
      </div>
    </div>
  );
};

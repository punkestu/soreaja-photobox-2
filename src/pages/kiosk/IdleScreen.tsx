import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { usePhotobox } from '../../context/PhotoboxContext';
import { KIOSK_HERO_BACKDROP } from '../../data/defaultFrames';

export const IdleScreen: React.FC = () => {
  const navigate = useNavigate();
  const { resetSession } = usePhotobox();
  const settings = useLiveQuery(() => db.settings.get('app_settings'), []);

  const handleStart = () => {
    resetSession();
    navigate('/app/frame-selection');
  };

  return (
    <div
      onClick={handleStart}
      role="region"
      aria-label="Layar Mulai Sesi Photobox"
      className="flex-1 relative flex items-center justify-center overflow-hidden cursor-pointer select-none min-h-[calc(100vh-65px)]"
    >
      {/* Editorial Studio Backdrop Image with Measured Contrast Scrim */}
      <img
        src={KIOSK_HERO_BACKDROP}
        alt="Studio Photobox SoreAja"
        referrerPolicy="no-referrer"
        className="absolute inset-0 w-full h-full object-cover opacity-50 scale-105 transition-transform duration-700"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0B] via-[#0A0A0B]/65 to-[#0A0A0B]/40" />

      <div className="relative z-10 max-w-4xl mx-auto px-6 py-12 text-center space-y-8">
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
            SoreAja — Photobox 2
          </h1>
          <p className="font-serif-editorial italic text-2xl sm:text-3xl text-zinc-300">
            Abadikan momen sore terbaikmu dalam cetakan strip analog klasik & animasi GIF.
          </p>
        </div>

        <div className="pt-4 flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleStart();
            }}
            className="px-10 py-5 text-base sm:text-lg font-display font-bold text-white bg-[#E11D48] hover:bg-[#BE123C] rounded-xl shadow-lg transition-transform active:scale-95 whitespace-nowrap cursor-pointer"
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

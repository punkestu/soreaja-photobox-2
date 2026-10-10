import React, { useState } from 'react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'admin' | 'kiosk';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'admin' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running in standalone PWA window, hide button
  if (isInstalled) {
    return null;
  }

  const isKiosk = variant === 'kiosk';

  // Desktop / Chromium / Android install trigger
  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className={`flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition-all active:scale-95 cursor-pointer whitespace-nowrap ${
          isKiosk
            ? 'min-h-[48px] bg-zinc-900/90 text-zinc-100 hover:bg-zinc-800 border border-zinc-800/80 shadow-sm'
            : 'min-h-[40px] bg-neutral-900 text-white hover:bg-neutral-800'
        }`}
      >
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        <span className="hidden sm:inline">Pasang PWA</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={`flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition-all active:scale-95 cursor-pointer whitespace-nowrap ${
            isKiosk
              ? 'min-h-[48px] bg-zinc-900/90 text-zinc-300 hover:text-white border border-zinc-800/80 shadow-sm'
              : 'min-h-[40px] border border-neutral-300 text-neutral-700 hover:bg-neutral-100'
          }`}
        >
          <span className="hidden sm:inline">PWA iPad</span>
          <span className="sm:hidden">PWA</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl text-neutral-900">
              <h3 className="font-display text-lg font-bold">Pasang SoreAja di iPad / iPhone</h3>
              <p className="mt-2.5 text-xs text-neutral-600 leading-relaxed">
                1. Ketuk tombol <strong>Share</strong> (ikon kotak dengan panah atas) di menu Safari.<br />
                2. Gulir ke bawah lalu pilih <strong>Add to Home Screen (Tambah ke Layar Utama)</strong>.<br />
                3. Aplikasi kini dapat dibuka secara penuh tanpa bilah peramban dan beroperasi offline.
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-lg bg-neutral-900 py-2.5 text-xs font-semibold text-white hover:bg-neutral-800 cursor-pointer"
              >
                Mengerti
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

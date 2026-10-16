import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { usePhotobox } from '../../context/PhotoboxContext';

export const PWAReloadPrompt: React.FC = () => {
  const { language } = usePhotobox();
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW(swUrl, r) {
      console.log('PWA Service Worker registered:', swUrl, r);
    },
    onRegisterError(error) {
      console.error('PWA Service Worker registration error:', error);
    },
  });

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  if (!offlineReady && !needRefresh) {
    return null;
  }

  const isEn = language === 'en';

  return (
    <aside
      aria-label="PWA Offline and Update Notification"
      role="status"
      className="fixed bottom-4 right-4 z-50 flex items-center gap-3.5 rounded-2xl bg-zinc-950/95 text-white p-4 shadow-2xl border border-zinc-800/90 backdrop-blur-md max-w-sm select-none animate-in fade-in slide-in-from-bottom-4 duration-300"
    >
      <div className="flex items-center gap-2.5">
        <span className="text-2xl">{offlineReady ? '⚡' : '🔄'}</span>
        <div className="text-xs">
          <p className="font-bold text-white text-sm">
            {offlineReady
              ? isEn
                ? 'Offline Ready'
                : 'Siap Berjalan Offline'
              : isEn
              ? 'Update Available'
              : 'Pembaruan Tersedia'}
          </p>
          <p className="text-zinc-400 mt-0.5 leading-relaxed">
            {offlineReady
              ? isEn
                ? 'App is cached and ready to work without internet connection.'
                : 'Aplikasi tersimpan dan siap digunakan tanpa koneksi internet.'
              : isEn
              ? 'New content available. Click reload to update.'
              : 'Versi baru tersedia. Klik muat ulang untuk memperbarui.'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 ml-auto shrink-0">
        {needRefresh && (
          <button
            type="button"
            onClick={() => updateServiceWorker(true)}
            className="px-3 py-1.5 bg-[var(--theme-accent,#E11D48)] hover:bg-[var(--theme-accent-hover,#BE123C)] text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-md active:scale-95"
          >
            {isEn ? 'Reload' : 'Muat Ulang'}
          </button>
        )}
        <button
          type="button"
          onClick={close}
          className="p-1.5 text-zinc-400 hover:text-white text-xs rounded-lg transition cursor-pointer hover:bg-zinc-800"
          aria-label={isEn ? 'Dismiss' : 'Tutup'}
        >
          ✕
        </button>
      </div>
    </aside>
  );
};

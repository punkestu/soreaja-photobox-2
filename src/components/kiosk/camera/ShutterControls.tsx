import React, { memo } from 'react';
import type { TranslationDictionary } from '../../../i18n/translations';

interface ShutterControlsProps {
  isCapturingSequence: boolean;
  isRetakeMode: boolean;
  retakeIndex: number | null;
  countdown: number | null;
  isPreparing?: boolean;
  isSaving?: boolean;
  isImageLoading?: boolean;
  countdownSeconds: number;
  onStartSequence: () => void;
  onInstantCapture: () => void;
  t: TranslationDictionary;
}

export const ShutterControls: React.FC<ShutterControlsProps> = memo(({
  isCapturingSequence,
  isRetakeMode,
  retakeIndex,
  countdown,
  isPreparing = false,
  isSaving = false,
  isImageLoading = false,
  countdownSeconds,
  onStartSequence,
  onInstantCapture,
  t,
}) => {
  const isBusy = isCapturingSequence || isSaving || isImageLoading;

  return (
    <div className="flex items-center gap-2 sm:gap-3 p-1.5 bg-black/50 backdrop-blur-md rounded-full border border-white/20 shadow-[0_15px_40px_rgba(0,0,0,0.8)]">
      <button
        type="button"
        disabled={isBusy}
        onClick={onStartSequence}
        className="min-h-[52px] sm:min-h-[60px] md:min-h-[64px] px-6 sm:px-9 md:px-11 py-3 text-sm sm:text-base md:text-lg font-extrabold text-white bg-[var(--theme-accent,#E11D48)] hover:bg-[var(--theme-accent-hover,#BE123C)] active:scale-95 disabled:opacity-50 rounded-full transition-all whitespace-nowrap cursor-pointer shadow-[0_0_35px_rgba(225,29,72,0.85)] flex items-center gap-2.5 ring-2 ring-white/30"
      >
        <span className="text-base sm:text-xl">{isSaving ? '💾' : isImageLoading ? '⏳' : '📸'}</span>
        <span>
          {isSaving
            ? 'Menyimpan...'
            : isImageLoading
              ? 'Memuat...'
              : isCapturingSequence
                ? isPreparing
                  ? '⏳ Siap-siap...'
                  : `⏱️ ${countdown ?? '...'}`
                : isRetakeMode
                  ? `↺ Retake #${(retakeIndex ?? 0) + 1}`
                  : `${t.camera.startSequence} (${countdownSeconds}s)`}
        </span>
      </button>

      <button
        type="button"
        disabled={isBusy}
        onClick={onInstantCapture}
        className="min-h-[52px] min-w-[52px] sm:min-h-[60px] sm:min-w-[60px] px-3 sm:px-4 py-3 text-xs sm:text-sm font-bold text-zinc-100 bg-black/60 hover:bg-black/85 active:scale-95 disabled:opacity-50 backdrop-blur-md border border-white/20 rounded-full transition-all whitespace-nowrap cursor-pointer shadow-xl flex items-center justify-center gap-1.5"
        title={t.camera.instantCapture}
      >
        <span className="text-base sm:text-lg">⚡</span>
        <span className="hidden md:inline font-semibold">{t.camera.instantCapture}</span>
      </button>
    </div>
  );
});

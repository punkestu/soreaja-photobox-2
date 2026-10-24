import React, { memo } from 'react';
import type { TranslationDictionary } from '../../../i18n/translations';

interface ShutterControlsProps {
  isCapturingSequence: boolean;
  isRetakeMode: boolean;
  retakeIndex: number | null;
  countdown: number | null;
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
  countdownSeconds,
  onStartSequence,
  onInstantCapture,
  t,
}) => {
  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <button
        type="button"
        disabled={isCapturingSequence}
        onClick={onStartSequence}
        className="min-h-[50px] sm:min-h-[60px] md:min-h-[64px] px-5 sm:px-8 md:px-10 py-2.5 sm:py-3 text-sm sm:text-base md:text-lg font-extrabold text-white bg-[var(--theme-accent,#E11D48)] hover:bg-[var(--theme-accent-hover,#BE123C)] active:scale-95 disabled:opacity-50 rounded-2xl transition-all whitespace-nowrap cursor-pointer shadow-[0_0_35px_rgba(225,29,72,0.75)] flex items-center gap-2 ring-2 ring-white/20"
      >
        <span className="text-base sm:text-lg">📸</span>
        <span>
          {isCapturingSequence
            ? `⏱️ ${countdown ?? '...'}`
            : isRetakeMode
            ? `↺ Retake #${(retakeIndex ?? 0) + 1}`
            : `${t.camera.startSequence} (${countdownSeconds}s)`}
        </span>
      </button>

      <button
        type="button"
        onClick={onInstantCapture}
        className="min-h-[50px] sm:min-h-[60px] md:min-h-[64px] px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-bold text-zinc-200 bg-black/85 hover:bg-zinc-800 active:scale-95 backdrop-blur-md border border-white/15 rounded-2xl transition-all whitespace-nowrap cursor-pointer shadow-xl flex items-center gap-1.5"
        title={t.camera.instantCapture}
      >
        <span>⚡</span>
        <span className="hidden md:inline">{t.camera.instantCapture}</span>
      </button>
    </div>
  );
});

import React, { memo } from 'react';

interface CountdownOverlayProps {
  countdown: number | null;
  isPreparing?: boolean;
  prepKey?: number | string;
  prepDurationMs?: number;
  isFlashing: boolean;
  isSaving?: boolean;
  isImageLoading?: boolean;
  savingTitle?: string;
  savingSubtitle?: string;
  imageLoadingTitle?: string;
  imageLoadingSubtitle?: string;
  getReadyText?: string;
}

export const CountdownOverlay: React.FC<CountdownOverlayProps> = memo(({
  countdown,
  isPreparing = false,
  prepKey = 0,
  prepDurationMs = 2500,
  isFlashing,
  isSaving = false,
  isImageLoading = false,
  savingTitle = 'Menyimpan Foto...',
  savingSubtitle = 'Mohon tunggu, sedang memproses foto kualitas studio...',
  imageLoadingTitle = 'Memuat Foto dari Kamera...',
  imageLoadingSubtitle = 'Sedang mentransfer foto kualitas tinggi dari kamera...',
  getReadyText = 'SIAP-SIAP POSE!',
}) => {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;

  return (
    <>
      {/* 1. Preparation Stage: Continuous Hardware-Accelerated Circular Progress */}
      {isPreparing && !isSaving && !isImageLoading && (
        <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px] flex flex-col items-center justify-center pointer-events-none z-30 animate-in fade-in duration-150 select-none">
          <style>{`
            @keyframes prepCircleAutoProgress {
              0% {
                stroke-dashoffset: ${circumference};
              }
              100% {
                stroke-dashoffset: 0;
              }
            }
          `}</style>
          <div className="relative flex items-center justify-center">
            {/* SVG Circular Progress Track & Auto-Progress Ring */}
            <svg
              className="w-28 h-28 sm:w-36 sm:h-36 -rotate-90 transform drop-shadow-[0_0_25px_rgba(0,0,0,0.8)]"
              viewBox="0 0 120 120"
            >
              {/* Background circle track */}
              <circle
                cx="60"
                cy="60"
                r={radius}
                className="text-white/20"
                strokeWidth="8"
                stroke="currentColor"
                fill="transparent"
              />
              {/* Auto progressing continuous ring */}
              <circle
                key={prepKey}
                cx="60"
                cy="60"
                r={radius}
                className="text-[var(--theme-accent,#E11D48)]"
                strokeWidth="8"
                strokeDasharray={circumference}
                strokeDashoffset={circumference}
                strokeLinecap="round"
                stroke="currentColor"
                fill="transparent"
                style={{
                  animation: `prepCircleAutoProgress ${prepDurationMs}ms linear forwards`,
                }}
              />
            </svg>
          </div>
        </div>
      )}

      {/* 2. Main Shot Countdown Overlay (3, 2, 1) */}
      {countdown !== null && !isPreparing && !isSaving && !isImageLoading && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center pointer-events-none z-30 animate-in fade-in duration-100 select-none">
          <span className="font-display text-8xl sm:text-[140px] md:text-[180px] font-extrabold text-white tabular-nums drop-shadow-[0_10px_35px_rgba(0,0,0,0.95)] animate-pulse">
            {countdown}
          </span>
          <p className="mt-2 text-sm sm:text-base md:text-lg font-mono-tabular text-zinc-200 uppercase tracking-widest drop-shadow font-bold text-center px-4">
            {getReadyText}
          </p>
        </div>
      )}

      {/* 3. Image Loading Screen (Downloading/processing from camera after shutter) */}
      {isImageLoading && !isSaving && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center pointer-events-auto z-40 animate-in fade-in duration-150 select-none">
          <div className="relative flex items-center justify-center mb-5">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-white/10 border-t-[var(--theme-accent,#E11D48)] animate-spin" />
            <span className="absolute text-xl sm:text-2xl animate-pulse">📷</span>
          </div>

          <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-white tracking-wide font-display text-center px-4">
            {imageLoadingTitle}
          </h3>

          <p className="mt-2 text-xs sm:text-sm text-zinc-300 font-mono text-center max-w-xs px-4">
            {imageLoadingSubtitle}
          </p>
        </div>
      )}

      {/* 4. High-Aesthetic Final Saving & Processing Loading Screen */}
      {isSaving && (
        <div className="absolute inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center pointer-events-auto z-40 animate-in fade-in duration-200 select-none">
          {/* Animated Spinner with Camera Glyph */}
          <div className="relative flex items-center justify-center mb-6">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-white/10 border-t-[var(--theme-accent,#E11D48)] animate-spin" />
            <span className="absolute text-2xl sm:text-3xl animate-bounce">📸</span>
          </div>

          <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white tracking-wide font-display text-center px-4">
            {savingTitle}
          </h2>

          <p className="mt-2.5 text-xs sm:text-sm text-zinc-400 font-mono text-center max-w-xs sm:max-w-md px-4 leading-relaxed">
            {savingSubtitle}
          </p>

          <div className="mt-6 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--theme-accent,#E11D48)] animate-ping" />
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
              Menyimpan resolusi penuh...
            </span>
          </div>
        </div>
      )}

      {/* 5. Flash Burst Effect */}
      {isFlashing && (
        <div className="absolute inset-0 bg-white animate-flash pointer-events-none z-50" />
      )}
    </>
  );
});

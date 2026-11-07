import React, { memo } from 'react';

interface PhotoTrayProps {
  totalShotsNeeded: number;
  localShots: string[];
  currentShotNumber: number;
  isRetakeMode: boolean;
  retakeIndex: number | null;
  photoSlotText?: string;
}

export const PhotoTray: React.FC<PhotoTrayProps> = memo(({
  totalShotsNeeded,
  localShots,
  currentShotNumber,
  isRetakeMode,
  retakeIndex,
  photoSlotText = 'Foto',
}) => {
  return (
    <div className="flex items-center gap-1.5 sm:gap-2 px-2 py-1 sm:px-2.5 sm:py-1.5 bg-black/60 hover:bg-black/75 backdrop-blur-md border border-white/20 rounded-2xl sm:rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.8)] transition-all select-none">
      {Array.from({ length: totalShotsNeeded }).map((_, idx) => {
        const shotSrc = localShots[idx];
        const isCurrent = !isRetakeMode && idx === currentShotNumber - 1;
        const isTargetRetake = isRetakeMode && retakeIndex === idx;
        return (
          <div
            key={idx}
            className={`w-8 h-8 sm:w-11 sm:h-11 md:w-12 md:h-12 rounded-lg sm:rounded-xl overflow-hidden relative flex items-center justify-center transition-all ${
              isTargetRetake || isCurrent
                ? 'bg-zinc-800 ring-2 ring-[var(--theme-accent,#E11D48)] shadow-[0_0_16px_rgba(225,29,72,0.7)] scale-105 z-10'
                : shotSrc
                ? 'bg-zinc-900 border border-white/20 opacity-90'
                : 'bg-white/5 border border-white/10 opacity-60'
            }`}
          >
            {shotSrc ? (
              <img
                src={shotSrc}
                alt={`${photoSlotText} ${idx + 1}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-[10px] sm:text-xs font-mono-tabular text-zinc-300 font-bold">
                #{idx + 1}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
});

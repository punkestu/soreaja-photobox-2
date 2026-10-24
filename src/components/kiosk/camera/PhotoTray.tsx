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
    <div className="flex items-center gap-1.5 p-1 sm:p-1.5 bg-black/85 backdrop-blur-md border border-white/15 rounded-2xl shadow-2xl">
      {Array.from({ length: totalShotsNeeded }).map((_, idx) => {
        const shotSrc = localShots[idx];
        const isCurrent = !isRetakeMode && idx === currentShotNumber - 1;
        const isTargetRetake = isRetakeMode && retakeIndex === idx;
        return (
          <div
            key={idx}
            className={`w-9 h-9 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-xl overflow-hidden relative bg-zinc-900/90 flex items-center justify-center transition-all ${
              isTargetRetake || isCurrent
                ? 'ring-2 ring-[var(--theme-accent,#E11D48)] shadow-[0_0_15px_rgba(225,29,72,0.6)] scale-105'
                : 'opacity-70 hover:opacity-100'
            }`}
          >
            {shotSrc ? (
              <img
                src={shotSrc}
                alt={`${photoSlotText} ${idx + 1}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-[10px] sm:text-xs font-mono-tabular text-zinc-400 font-bold">
                #{idx + 1}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
});

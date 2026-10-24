import React, { memo } from 'react';

interface CountdownOverlayProps {
  countdown: number | null;
  isFlashing: boolean;
  getReadyText?: string;
}

export const CountdownOverlay: React.FC<CountdownOverlayProps> = memo(({
  countdown,
  isFlashing,
  getReadyText = 'SIAP-SIAP POSE!',
}) => {
  return (
    <>
      {/* Countdown Big Center Overlay (z-30) */}
      {countdown !== null && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center pointer-events-none z-30">
          <span className="font-display text-8xl sm:text-[140px] md:text-[180px] font-extrabold text-white tabular-nums drop-shadow-[0_10px_35px_rgba(0,0,0,0.95)] animate-pulse">
            {countdown}
          </span>
          <p className="mt-2 text-sm sm:text-base md:text-lg font-mono-tabular text-zinc-200 uppercase tracking-widest drop-shadow font-bold">
            {getReadyText}
          </p>
        </div>
      )}

      {/* Flash Burst Effect (z-40) */}
      {isFlashing && (
        <div className="absolute inset-0 bg-white animate-flash pointer-events-none z-40" />
      )}
    </>
  );
});
